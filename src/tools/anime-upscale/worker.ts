/// <reference lib="webworker" />

export {};

type PipelineDtype = "fp32" | "q4" | "uint8" | "q4f16";
type RuntimeMode = "webgpu" | "wasm";

type TileConfig = {
  size: number;
  overlap: number;
};

type WorkerImagePayload = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type RunMessage = {
  type: "run";
  id: number;
  runtime: RuntimeMode;
  modelId: string;
  dtype: PipelineDtype;
  image: WorkerImagePayload;
  scale?: number;
  tile?: TileConfig;
};

type TransformersRawImage = import("@huggingface/transformers").RawImage;

type ModelProgressEvent = {
  status?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

type ProgressMessage = {
  type: "progress";
  id: number;
  progress?: number | null;
  status?: string | null;
};

type ResultMessage = {
  type: "result";
  id: number;
  output: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
  };
};

type ErrorMessage = {
  type: "error";
  id: number;
  message: string;
};

type IncomingMessage = RunMessage;
type DiagnosticsMessage = {
  type: "diagnostics";
  id: number;
  webgpuFp16Enabled?: boolean | null;
};

type OutgoingMessage =
  | ProgressMessage
  | ResultMessage
  | ErrorMessage
  | DiagnosticsMessage;

type UpscalePipeline = ((
  input: TransformersRawImage
) => Promise<TransformersRawImage | TransformersRawImage[]>) & {
  dispose?: () => Promise<void>;
};

type PipelineFactory = (
  task: string,
  model: string,
  options?: Record<string, unknown>
) => Promise<UpscalePipeline>;

type RuntimeEnv = {
  allowLocalModels?: boolean;
  useBrowserCache?: boolean;
  backends?: {
    onnx?: {
      wasm?: {
        numThreads?: number;
      };
      webgpu?: {
        device?: {
          features?: {
            has?: (value: string) => boolean;
          };
        };
      };
    };
  };
};

type DomShimElement = {
  [key: string]: unknown;
  onload?: ((event: { type: string }) => void) | null;
};

type WorkerRuntime = DedicatedWorkerGlobalScope & {
  document?: {
    createElement?: (tag: string) => DomShimElement;
    createTextNode?: (text: string) => DomShimElement;
    getElementsByTagName?: (tag: string) => DomShimElement[];
    querySelector?: (selector: string) => DomShimElement | null;
    head?: DomShimElement;
    body?: DomShimElement;
  };
  _N_E_STYLE_LOAD?: (href: string) => Promise<void>;
};

const ctx = self as unknown as WorkerRuntime;

const ensureDomShims = () => {
  const runtime = ctx as WorkerRuntime & Record<string, unknown>;
  if (typeof runtime._N_E_STYLE_LOAD !== "function") {
    runtime._N_E_STYLE_LOAD = async () => {};
  }
  if (runtime.document) return;
  const noop = () => {};
  const appendChild = (el: DomShimElement) => {
    if (typeof el.onload === "function") {
      const handleLoad = el.onload;
      setTimeout(() => handleLoad({ type: "load" }), 0);
    }
    return el;
  };
  const head = { appendChild };
  const body = { appendChild };
  const createElement = (tag: string) => {
    const normalized = tag?.toLowerCase?.() ?? "";
    if (normalized === "canvas") {
      if (typeof OffscreenCanvas !== "undefined") {
        return new OffscreenCanvas(1, 1) as unknown as DomShimElement;
      }
      return {
        width: 1,
        height: 1,
        getContext: () => null,
      };
    }
    if (normalized === "a") {
      return {
        href: "",
        download: "",
        click: noop,
        setAttribute: noop,
        getAttribute: () => null,
      };
    }
    if (normalized === "link" || normalized === "style") {
      return {
        rel: "",
        type: "",
        href: "",
        onload: null,
        onerror: null,
        appendChild: noop,
        setAttribute: noop,
        getAttribute: () => null,
        parentNode: { removeChild: noop },
      };
    }
    if (normalized === "video") {
      return {
        play: noop,
        pause: noop,
        addEventListener: noop,
        removeEventListener: noop,
        setAttribute: noop,
      };
    }
    return {
      setAttribute: noop,
      getAttribute: () => null,
      appendChild: noop,
      parentNode: { removeChild: noop },
      style: {},
    };
  };
  runtime.document = {
    createElement,
    createTextNode: (text: string) => ({ textContent: text }),
    getElementsByTagName: (tag: string) => {
      const normalized = tag?.toLowerCase?.() ?? "";
      if (normalized === "head") return [head];
      if (normalized === "body") return [body];
      return [];
    },
    querySelector: (selector: string) => {
      const normalized = selector?.toLowerCase?.() ?? "";
      if (normalized === "head") return head;
      if (normalized === "body") return body;
      return null;
    },
    head,
    body,
  };
};

ensureDomShims();

type TransformersModule = typeof import("@huggingface/transformers");

let transformersModule: TransformersModule | null = null;
let cachedPipeline: UpscalePipeline | null = null;
let cachedKey: string | null = null;
let activeRunId: number | null = null;

const loadTransformers = async () => {
  if (!transformersModule) {
    transformersModule = await import(
      /* webpackMode: "eager" */ "@huggingface/transformers"
    );
  }
  return transformersModule;
};

const normalizeProgress = (event: ModelProgressEvent) => {
  if (typeof event.progress === "number") {
    return event.progress <= 1 ? Math.round(event.progress * 100) : Math.round(event.progress);
  }
  if (typeof event.loaded === "number" && typeof event.total === "number") {
    return Math.round((event.loaded / event.total) * 100);
  }
  return null;
};

const getWasmThreadCount = () => {
  const supportsThreads = typeof SharedArrayBuffer !== "undefined" && ctx.crossOriginIsolated;
  const cores = ctx.navigator?.hardwareConcurrency ?? 4;
  return supportsThreads ? Math.max(1, cores) : 1;
};

const postWorkerMessage = (message: OutgoingMessage, transfer?: Transferable[]) => {
  if (transfer) {
    ctx.postMessage(message, transfer);
  } else {
    ctx.postMessage(message);
  }
};

const getCacheKey = (modelId: string, dtype: PipelineDtype, runtime: RuntimeMode) =>
  `${modelId}:${dtype}:${runtime}`;

const ensurePipeline = async (
  modelId: string,
  dtype: PipelineDtype,
  runtime: RuntimeMode,
  runId: number
) => {
  const { env, pipeline } = await loadTransformers();
  const runtimeEnv = env as RuntimeEnv;
  const cacheKey = getCacheKey(modelId, dtype, runtime);
  if (cachedPipeline && cachedKey === cacheKey) return cachedPipeline;
  if (cachedPipeline?.dispose) {
    await cachedPipeline.dispose();
  }
  cachedPipeline = null;
  cachedKey = null;
  if (runtime === "webgpu") {
    const hasWebGPU = Boolean((ctx.navigator as Navigator & { gpu?: unknown })?.gpu);
    if (!hasWebGPU) {
      throw new Error("WebGPU is not available in this worker. Switch to WASM.");
    }
  }
  runtimeEnv.allowLocalModels = false;
  runtimeEnv.useBrowserCache = typeof caches !== "undefined";
  runtimeEnv.backends ??= {};
  runtimeEnv.backends.onnx ??= {};
  if (runtime === "wasm") {
    runtimeEnv.backends.onnx.wasm ??= {};
    runtimeEnv.backends.onnx.wasm.numThreads = getWasmThreadCount();
  }
  const createPipeline = pipeline as unknown as PipelineFactory;
  const upscaler = await createPipeline("image-to-image", modelId, {
    device: runtime,
    dtype,
    session_options: {
      logSeverityLevel: 3,
    },
    progress_callback: (progress: ModelProgressEvent) => {
      const normalized = normalizeProgress(progress);
      if (normalized !== null || progress.status) {
        postWorkerMessage({
          type: "progress",
          id: runId,
          progress: normalized ?? undefined,
          status: progress.status ?? undefined,
        });
      }
    },
  });
  cachedPipeline = upscaler;
  cachedKey = cacheKey;
  if (runtime === "webgpu") {
    const webgpuFp16Enabled =
      runtimeEnv.backends?.onnx?.webgpu?.device?.features?.has?.("shader-f16");
    if (typeof webgpuFp16Enabled === "boolean") {
      postWorkerMessage({
        type: "diagnostics",
        id: runId,
        webgpuFp16Enabled,
      });
    }
  }
  return upscaler;
};

type TileRegion = {
  coreLeft: number;
  coreTop: number;
  coreRight: number;
  coreBottom: number;
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
};

const clampTileConfig = (tile: TileConfig) => {
  const size = Math.max(64, Math.round(tile.size));
  const overlap = Math.max(0, Math.min(Math.round(tile.overlap), Math.floor(size / 2)));
  return { size, overlap };
};

const buildTileLayout = (width: number, height: number, tile: TileConfig) => {
  const { size, overlap } = clampTileConfig(tile);
  const columns = Math.max(1, Math.ceil(width / size));
  const rows = Math.max(1, Math.ceil(height / size));
  const tiles: TileRegion[] = [];
  for (let row = 0; row < rows; row += 1) {
    const coreTop = row * size;
    const coreBottom = Math.min(coreTop + size, height);
    const cropTop = Math.max(0, coreTop - overlap);
    const cropBottom = Math.min(height, coreBottom + overlap);
    for (let column = 0; column < columns; column += 1) {
      const coreLeft = column * size;
      const coreRight = Math.min(coreLeft + size, width);
      const cropLeft = Math.max(0, coreLeft - overlap);
      const cropRight = Math.min(width, coreRight + overlap);
      tiles.push({
        coreLeft,
        coreTop,
        coreRight,
        coreBottom,
        cropLeft,
        cropTop,
        cropRight,
        cropBottom,
      });
    }
  }
  return { tiles, columns, rows, size, overlap };
};

const extractTileData = (
  source: Uint8ClampedArray,
  sourceWidth: number,
  left: number,
  top: number,
  width: number,
  height: number
) => {
  const sourceStride = sourceWidth * 4;
  const tileStride = width * 4;
  const tileData = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = (top + row) * sourceStride + left * 4;
    const destStart = row * tileStride;
    tileData.set(source.subarray(sourceStart, sourceStart + tileStride), destStart);
  }
  return tileData;
};

const pickPipelineOutput = (
  result: TransformersRawImage | TransformersRawImage[]
) => {
  const output = Array.isArray(result) ? result[0] : result;
  if (!output) {
    throw new Error("No output was produced.");
  }
  return output;
};

const toRgbaData = (raw: TransformersRawImage) => {
  if (raw.channels === 4) {
    return raw.data instanceof Uint8ClampedArray
      ? raw.data
      : new Uint8ClampedArray(raw.data);
  }
  const rgba = new Uint8ClampedArray(raw.width * raw.height * 4);
  const step = raw.channels;
  for (let i = 0, j = 0; i < raw.data.length; i += step, j += 4) {
    const r = raw.data[i];
    const g = step > 1 ? raw.data[i + 1] : r;
    const b = step > 2 ? raw.data[i + 2] : r;
    rgba[j] = r;
    rgba[j + 1] = g;
    rgba[j + 2] = b;
    rgba[j + 3] = 255;
  }
  return rgba;
};

const blitRgba = (
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  sourceX: number,
  sourceY: number,
  copyWidth: number,
  copyHeight: number
) => {
  const maxWidth = Math.min(copyWidth, sourceWidth - sourceX, targetWidth - destX);
  const maxHeight = Math.min(
    copyHeight,
    sourceHeight - sourceY,
    targetHeight - destY
  );
  if (maxWidth <= 0 || maxHeight <= 0) return;
  const targetStride = targetWidth * 4;
  const sourceStride = sourceWidth * 4;
  for (let row = 0; row < maxHeight; row += 1) {
    const sourceStart = (sourceY + row) * sourceStride + sourceX * 4;
    const targetStart = (destY + row) * targetStride + destX * 4;
    target.set(source.subarray(sourceStart, sourceStart + maxWidth * 4), targetStart);
  }
};

ctx.addEventListener("error", (event) => {
  event.preventDefault();
  const errorEvent = event as ErrorEvent;
  const parts = [
    errorEvent?.message ? `message: ${errorEvent.message}` : null,
    errorEvent?.filename ? `file: ${errorEvent.filename}` : null,
    typeof errorEvent?.lineno === "number" ? `line: ${errorEvent.lineno}` : null,
    typeof errorEvent?.colno === "number" ? `col: ${errorEvent.colno}` : null,
  ].filter(Boolean);
  const message = parts.length ? `Worker error (${parts.join(", ")})` : "Worker error.";
  postWorkerMessage({ type: "error", id: activeRunId ?? -1, message });
});

ctx.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : "Worker rejected a promise.";
  postWorkerMessage({ type: "error", id: activeRunId ?? -1, message });
});

ctx.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const data = event.data;
  if (data.type !== "run") return;
  activeRunId = data.id;
  try {
    const pipeline = await ensurePipeline(
      data.modelId,
      data.dtype,
      data.runtime,
      data.id
    );
    const { RawImage } = await loadTransformers();
    if (data.tile) {
      const layout = buildTileLayout(data.image.width, data.image.height, data.tile);
      const tileCount = layout.tiles.length;
      let scale =
        typeof data.scale === "number" && data.scale > 0 ? data.scale : null;
      let outputWidth = 0;
      let outputHeight = 0;
      let outputData: Uint8ClampedArray | null = null;
      if (scale) {
        outputWidth = data.image.width * scale;
        outputHeight = data.image.height * scale;
        outputData = new Uint8ClampedArray(outputWidth * outputHeight * 4);
      }
      for (let index = 0; index < tileCount; index += 1) {
        const tileRegion = layout.tiles[index];
        const cropWidth = tileRegion.cropRight - tileRegion.cropLeft;
        const cropHeight = tileRegion.cropBottom - tileRegion.cropTop;
        const tileData = extractTileData(
          data.image.data,
          data.image.width,
          tileRegion.cropLeft,
          tileRegion.cropTop,
          cropWidth,
          cropHeight
        );
        const tileInput = new RawImage(tileData, cropWidth, cropHeight, 4);
        const result = await pipeline(tileInput);
        const output = pickPipelineOutput(result);
        if (!scale) {
          const computed = Math.round(output.width / cropWidth);
          scale = computed > 0 ? computed : 1;
          outputWidth = data.image.width * scale;
          outputHeight = data.image.height * scale;
          outputData = new Uint8ClampedArray(outputWidth * outputHeight * 4);
        }
        if (!outputData) {
          throw new Error("Output buffer could not be allocated.");
        }
        const rgba = toRgbaData(output);
        const trimLeft = (tileRegion.coreLeft - tileRegion.cropLeft) * scale;
        const trimTop = (tileRegion.coreTop - tileRegion.cropTop) * scale;
        const trimRight = (tileRegion.cropRight - tileRegion.coreRight) * scale;
        const trimBottom = (tileRegion.cropBottom - tileRegion.coreBottom) * scale;
        const destX = tileRegion.coreLeft * scale;
        const destY = tileRegion.coreTop * scale;
        const copyWidth = output.width - trimLeft - trimRight;
        const copyHeight = output.height - trimTop - trimBottom;
        blitRgba(
          outputData,
          outputWidth,
          outputHeight,
          rgba,
          output.width,
          output.height,
          destX,
          destY,
          trimLeft,
          trimTop,
          copyWidth,
          copyHeight
        );
        const progress = Math.round(((index + 1) / tileCount) * 100);
        postWorkerMessage({
          type: "progress",
          id: data.id,
          progress,
          status: `Upscaling tiles (${index + 1}/${tileCount})...`,
        });
      }
      if (!outputData || !scale) {
        throw new Error("No output was produced.");
      }
      postWorkerMessage(
        {
          type: "result",
          id: data.id,
          output: {
            width: outputWidth,
            height: outputHeight,
            channels: 4,
            data: outputData,
          },
        },
        [outputData.buffer]
      );
      return;
    }
    const input = new RawImage(data.image.data, data.image.width, data.image.height, 4);
    const result = await pipeline(input);
    const output = pickPipelineOutput(result);
    const outputData =
      output.data instanceof Uint8ClampedArray
        ? new Uint8ClampedArray(output.data)
        : new Uint8Array(output.data);
    postWorkerMessage(
      {
        type: "result",
        id: data.id,
        output: {
          width: output.width,
          height: output.height,
          channels: output.channels,
          data: outputData,
        },
      },
      [outputData.buffer]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upscale failed.";
    postWorkerMessage({ type: "error", id: data.id, message });
  } finally {
    activeRunId = null;
  }
};
