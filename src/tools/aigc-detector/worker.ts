/// <reference lib="webworker" />

type RunMessage = {
  type: "run";
  id: number;
  modelId: string;
  text: string;
  chunkSize?: number;
};

type ClassificationResult = {
  label: string;
  score: number;
};

const MAX_CHUNK_CHARS = 512;

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
  results: ClassificationResult[];
  duration: number;
};

type ErrorMessage = {
  type: "error";
  id: number;
  message: string;
};

type IncomingMessage = RunMessage;

type OutgoingMessage = ProgressMessage | ResultMessage | ErrorMessage;

type TextClassificationPipeline = ((
  input: string,
  options?: Record<string, unknown>
) => Promise<unknown>) & {
  dispose?: () => Promise<void>;
  tokenizer?: { model_max_length?: number | null };
};

type PipelineFactory = (
  task: string,
  model: string,
  options?: Record<string, unknown>
) => Promise<TextClassificationPipeline>;

type RuntimeEnv = {
  allowLocalModels?: boolean;
  useBrowserCache?: boolean;
  backends?: {
    onnx?: {
      wasm?: {
        numThreads?: number;
      };
    };
  };
};

type WorkerRuntime = DedicatedWorkerGlobalScope & {
  document?: {
    createElement?: (tag: string) => any;
    createTextNode?: (text: string) => any;
    getElementsByTagName?: (tag: string) => any[];
    querySelector?: (selector: string) => any | null;
    head?: { appendChild?: (el: any) => void };
    body?: { appendChild?: (el: any) => void };
  };
  _N_E_STYLE_LOAD?: (href: string) => Promise<void>;
};

const ctx = self as unknown as WorkerRuntime;

const ensureDomShims = () => {
  const runtime = ctx as WorkerRuntime & Record<string, any>;
  if (typeof runtime._N_E_STYLE_LOAD !== "function") {
    runtime._N_E_STYLE_LOAD = async () => {};
  }
  if (runtime.document) return;
  const noop = () => {};
  const appendChild = (el: any) => {
    if (el?.onload) {
      setTimeout(() => el.onload({ type: "load" }), 0);
    }
    return el;
  };
  const head = { appendChild };
  const body = { appendChild };
  const createElement = (tag: string) => {
    const normalized = tag?.toLowerCase?.() ?? "";
    if (normalized === "canvas") {
      if (typeof OffscreenCanvas !== "undefined") {
        return new OffscreenCanvas(1, 1);
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
let cachedPipeline: TextClassificationPipeline | null = null;
let cachedModelId: string | null = null;
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
    return event.progress <= 1
      ? Math.round(event.progress * 100)
      : Math.round(event.progress);
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

const postWorkerMessage = (message: OutgoingMessage) => {
  ctx.postMessage(message);
};

const ensurePipeline = async (modelId: string, runId: number) => {
  const { env, pipeline } = await loadTransformers();
  const runtimeEnv = env as RuntimeEnv;
  if (cachedPipeline && cachedModelId === modelId) return cachedPipeline;
  if (cachedPipeline?.dispose) {
    await cachedPipeline.dispose();
  }
  cachedPipeline = null;
  cachedModelId = null;
  runtimeEnv.allowLocalModels = false;
  runtimeEnv.useBrowserCache = typeof caches !== "undefined";
  runtimeEnv.backends ??= {};
  runtimeEnv.backends.onnx ??= {};
  runtimeEnv.backends.onnx.wasm ??= {};
  runtimeEnv.backends.onnx.wasm.numThreads = getWasmThreadCount();
  const createPipeline = pipeline as unknown as PipelineFactory;
  const classifier = await createPipeline("text-classification", modelId, {
    device: "wasm",
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
  if (classifier.tokenizer) {
    classifier.tokenizer.model_max_length = 512;
  }
  cachedPipeline = classifier;
  cachedModelId = modelId;
  return classifier;
};

const clampChunkSize = (value?: number | null) => {
  const fallback = 400;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return Math.min(MAX_CHUNK_CHARS, Math.max(1, rounded));
};

const splitText = (text: string, chunkSize: number) => {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.length ? chunks : [text];
};

const normalizeResults = (output: unknown): ClassificationResult[] => {
  if (Array.isArray(output)) {
    if (output.length > 0 && Array.isArray(output[0])) {
      const chunkResults = output as ClassificationResult[][];
      const chunkCount = chunkResults.length || 1;
      const totals = new Map<string, number>();
      chunkResults.forEach((chunk) => {
        chunk.forEach((result) => {
          const score = typeof result.score === "number" ? result.score : 0;
          totals.set(result.label, (totals.get(result.label) ?? 0) + score);
        });
      });
      return Array.from(totals.entries()).map(([label, sum]) => ({
        label,
        score: sum / chunkCount,
      }));
    }
    return output as ClassificationResult[];
  }
  if (output && typeof output === "object") {
    const record = output as ClassificationResult;
    if (typeof record.label === "string" && typeof record.score === "number") {
      return [record];
    }
  }
  return [];
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
    const startedAt = performance.now();
    const pipeline = await ensurePipeline(data.modelId, data.id);
    const chunkSize = clampChunkSize(data.chunkSize);
    const chunks = splitText(data.text, chunkSize);
    const output = await pipeline(chunks, { top_k: 5 });
    const results = normalizeResults(output).sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );
    postWorkerMessage({
      type: "result",
      id: data.id,
      results,
      duration: Math.round(performance.now() - startedAt),
    });
  } catch (err) {
    postWorkerMessage({
      type: "error",
      id: data.id,
      message: formatErrorMessage(err),
    });
  } finally {
    activeRunId = null;
  }
};
