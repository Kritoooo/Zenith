/// <reference lib="webworker" />

export {};

type WorkerImagePayload = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type ModelConfig = {
  detectionPath: string;
  recognitionPath: string;
  dictPath: string;
};

type RunMessage = {
  type: "run";
  id: number;
  image: WorkerImagePayload;
  model: ModelConfig;
};

type DisposeMessage = {
  type: "dispose";
  id: number;
};

type ProgressMessage = {
  type: "progress";
  id: number;
  progress?: number | null;
  status?: string | null;
};

type RecognitionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RecognitionResult = {
  text: string;
  confidence: number;
  box: RecognitionBox;
};

type OcrLine = {
  text: string;
  confidence: number;
  box: RecognitionBox;
  count: number;
};

type ResultMessage = {
  type: "result";
  id: number;
  text: string;
  confidence: number;
  duration: number;
  lines: OcrLine[];
  items: RecognitionResult[];
};

type ErrorMessage = {
  type: "error";
  id: number;
  message: string;
};

type DiagnosticsMessage = {
  type: "diagnostics";
  id: number;
  webgpuAvailable: boolean;
};

type IncomingMessage = RunMessage | DisposeMessage;
type OutgoingMessage =
  | ProgressMessage
  | ResultMessage
  | ErrorMessage
  | DiagnosticsMessage;

type PaddleOcrServiceType = import("paddleocr").PaddleOcrService;
type PaddleOcrOptions = import("paddleocr").PaddleOptions;

const MODEL_BASE_URL =
  "https://huggingface.co/monkt/paddleocr-onnx/resolve/main";

const ctx = self as DedicatedWorkerGlobalScope;

let ortModule: typeof import("onnxruntime-web/webgpu") | null = null;
let PaddleOcrService: typeof import("paddleocr").PaddleOcrService | null = null;
let cachedService: PaddleOcrServiceType | null = null;
let cachedKey: string | null = null;
let patchedWebgpu = false;

const assetCache = new Map<string, ArrayBuffer | string | string[]>();

const clampConfidence = (value: number) => Math.min(1, Math.max(0, value));

const normalizeConfidence = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clampConfidence(value);
};

const averageConfidence = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
};

const postWorkerMessage = (message: OutgoingMessage) => {
  ctx.postMessage(message);
};

const hasWebGPU = () =>
  Boolean((ctx.navigator as Navigator & { gpu?: unknown })?.gpu);

const sendStatus = (id: number, status: string, progress?: number | null) => {
  postWorkerMessage({ type: "progress", id, status, progress });
};

const loadOrt = async () => {
  if (!ortModule) {
    ortModule = await import("onnxruntime-web/webgpu");
  }
  if (!patchedWebgpu) {
    const originalCreate = ortModule.InferenceSession.create.bind(
      ortModule.InferenceSession
    ) as (
      model: string | ArrayBufferLike | Uint8Array,
      options?: Record<string, unknown>
    ) => Promise<unknown>;
    (ortModule.InferenceSession as unknown as {
      create: typeof originalCreate;
    }).create = (model, options) =>
      originalCreate(model, {
        ...(options ?? {}),
        executionProviders: ["webgpu"],
      });
    patchedWebgpu = true;
  }
  return ortModule;
};

const loadPaddleOcr = async () => {
  if (PaddleOcrService) return PaddleOcrService;
  const moduleResult = await import("paddleocr");
  const fromModule =
    (moduleResult as { PaddleOcrService?: unknown }).PaddleOcrService ??
    (moduleResult as { default?: { PaddleOcrService?: unknown } }).default
      ?.PaddleOcrService;
  const fromGlobal = (ctx as unknown as { paddleocr?: { PaddleOcrService?: unknown } })
    .paddleocr?.PaddleOcrService;
  const resolved = fromModule ?? fromGlobal;
  if (!resolved) {
    throw new Error("Failed to load PaddleOCR. Export not found.");
  }
  PaddleOcrService = resolved as typeof import("paddleocr").PaddleOcrService;
  return PaddleOcrService;
};

const fetchArrayBuffer = async (
  url: string,
  runId: number,
  label: string
) => {
  const cached = assetCache.get(url);
  if (cached instanceof ArrayBuffer) return cached;
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}.`);
  }
  const total = Number(response.headers.get("content-length") || "0");
  if (!response.body || !total) {
    const buffer = await response.arrayBuffer();
    assetCache.set(url, buffer);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      const progress = Math.round((received / total) * 100);
      sendStatus(runId, label, progress);
    }
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  const buffer = merged.buffer;
  assetCache.set(url, buffer);
  return buffer;
};

const fetchText = async (url: string, runId: number, label: string) => {
  const cached = assetCache.get(url);
  if (typeof cached === "string") return cached;
  const buffer = await fetchArrayBuffer(url, runId, label);
  const text = new TextDecoder().decode(new Uint8Array(buffer));
  assetCache.set(url, text);
  return text;
};

const parseDictionary = (text: string) => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const filtered = lines.filter((line) => line.length > 0);
  if (filtered[0] !== "") filtered.unshift("");
  return filtered;
};

const buildLineBox = (line: RecognitionResult[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const item of line) {
    const { x, y, width, height } = item.box;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

const buildLines = (lines: RecognitionResult[][] | undefined) => {
  if (!lines) return [];
  return lines
    .map((line) => {
      const text = line.map((item) => item.text).join("");
      let sum = 0;
      let count = 0;
      for (const item of line) {
        const confidence = normalizeConfidence(item.confidence);
        if (confidence === null) continue;
        sum += confidence;
        count += 1;
      }
      const confidence = count > 0 ? sum / count : 0;
      return {
        text,
        confidence,
        box: buildLineBox(line),
        count: line.length,
      };
    })
    .filter((line) => line.text.length > 0);
};

const ensureService = async (model: ModelConfig, runId: number) => {
  const key = `${model.detectionPath}|${model.recognitionPath}|${model.dictPath}`;
  if (cachedService && cachedKey === key) return cachedService;
  if (cachedService) {
    await cachedService.destroy();
  }
  cachedService = null;
  cachedKey = null;
  if (!hasWebGPU()) {
    throw new Error("WebGPU is not available in this browser.");
  }
  postWorkerMessage({ type: "diagnostics", id: runId, webgpuAvailable: true });
  const ort = await loadOrt();
  const PaddleOcr = await loadPaddleOcr();
  const detUrl = `${MODEL_BASE_URL}/${model.detectionPath}`;
  const recUrl = `${MODEL_BASE_URL}/${model.recognitionPath}`;
  const dictUrl = `${MODEL_BASE_URL}/${model.dictPath}`;
  sendStatus(runId, "Downloading detection model", 0);
  const detBuffer = await fetchArrayBuffer(
    detUrl,
    runId,
    "Downloading detection model"
  );
  sendStatus(runId, "Downloading recognition model", 0);
  const recBuffer = await fetchArrayBuffer(
    recUrl,
    runId,
    "Downloading recognition model"
  );
  sendStatus(runId, "Downloading dictionary", 0);
  const dictText = await fetchText(dictUrl, runId, "Downloading dictionary");
  const dict = parseDictionary(dictText);
  sendStatus(runId, "Initializing OCR", null);
  const service = await PaddleOcr.createInstance({
    ort,
    detection: { modelBuffer: detBuffer },
    recognition: { modelBuffer: recBuffer, charactersDictionary: dict },
  } as PaddleOcrOptions);
  cachedService = service;
  cachedKey = key;
  return service;
};

const formatErrorMessage = (err: unknown) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown worker error.";
    }
  }
  return "Unknown worker error.";
};

ctx.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const data = event.data;
  if (data.type === "dispose") {
    if (cachedService) {
      await cachedService.destroy();
    }
    cachedService = null;
    cachedKey = null;
    assetCache.clear();
    return;
  }
  if (data.type !== "run") return;
  try {
    if (!hasWebGPU()) {
      postWorkerMessage({
        type: "diagnostics",
        id: data.id,
        webgpuAvailable: false,
      });
      throw new Error("WebGPU is not available. Use a compatible browser.");
    }
    sendStatus(data.id, "Preparing image", null);
    const startedAt = performance.now();
    const service = await ensureService(data.model, data.id);
    sendStatus(data.id, "Running OCR", null);
    const rgba = new Uint8Array(
      data.image.data.buffer,
      data.image.data.byteOffset,
      data.image.data.byteLength
    );
    const results = await service.recognize({
      data: rgba,
      width: data.image.width,
      height: data.image.height,
    });
    const processed = service.processRecognition(results);
    const lines = buildLines(processed.lines);
    const lineConfidenceValues = lines
      .map((line) => line.confidence)
      .filter((value) => Number.isFinite(value));
    const processedConfidence = normalizeConfidence(processed.confidence);
    postWorkerMessage({
      type: "result",
      id: data.id,
      text: processed.text,
      confidence:
        processedConfidence ?? averageConfidence(lineConfidenceValues),
      duration: Math.round(performance.now() - startedAt),
      lines,
      items: results,
    });
  } catch (err) {
    postWorkerMessage({
      type: "error",
      id: data.id,
      message: formatErrorMessage(err),
    });
  } finally {
  }
};
