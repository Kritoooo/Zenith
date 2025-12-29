"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";

import { ArrowLeftIcon, UploadIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

type UpscaleModelId = "2x" | "4x";
type PipelineDtype = "fp32" | "q4" | "uint8" | "q4f16";
type PrecisionMode = PipelineDtype;
type RuntimeMode = "webgpu" | "wasm";
type MemoryMode = "auto" | "keep";
type TileMode = "full" | "tiled";
type TileConfig = {
  size: number;
  overlap: number;
};

type ModelOption = {
  id: UpscaleModelId;
  label: string;
  scale: number;
  modelId: string;
  sourceUrl: string;
  summary: string;
};

type RawImage = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
};

type WorkerImagePayload = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type WorkerRunRequest = {
  type: "run";
  id: number;
  runtime: RuntimeMode;
  modelId: string;
  dtype: PipelineDtype;
  image: WorkerImagePayload;
  scale?: number;
  tile?: TileConfig;
};

type WorkerProgressMessage = {
  type: "progress";
  id: number;
  progress?: number | null;
  status?: string | null;
};

type WorkerResultMessage = {
  type: "result";
  id: number;
  output: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
  };
};

type WorkerErrorMessage = {
  type: "error";
  id: number;
  message: string;
};

type WorkerDiagnosticsMessage = {
  type: "diagnostics";
  id: number;
  webgpuFp16Enabled?: boolean | null;
};

type WorkerResponseMessage =
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage
  | WorkerDiagnosticsMessage;

type RuntimeDiagnostics = {
  hasWebGPU: boolean | null;
  webgpuFp16: boolean | null;
  webgpuFp16Enabled: boolean | null;
  crossOriginIsolated: boolean | null;
  sharedArrayBuffer: boolean | null;
  hardwareConcurrency: number | null;
  wasmThreads: number | null;
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "2x",
    label: "2x RRDB GAN",
    scale: 2,
    modelId: "Xenova/2x_APISR_RRDB_GAN_generator-onnx",
    sourceUrl: "https://huggingface.co/Xenova/2x_APISR_RRDB_GAN_generator-onnx",
    summary: "Sharper line art with light texture cleanup.",
  },
  {
    id: "4x",
    label: "4x GRL GAN",
    scale: 4,
    modelId: "Xenova/4x_APISR_GRL_GAN_generator-onnx",
    sourceUrl: "https://huggingface.co/Xenova/4x_APISR_GRL_GAN_generator-onnx",
    summary: "Heavy upscale for posters and print output.",
  },
];

const PRECISION_OPTIONS: Array<{
  id: PrecisionMode;
  label: string;
  detail: string;
  summary: string;
}> = [
  {
    id: "fp32",
    label: "Quality",
    detail: "FP32",
    summary: "Full precision for best detail.",
  },
  {
    id: "q4",
    label: "Ultra Fast",
    detail: "Q4",
    summary: "Fastest overall with 4-bit weights.",
  },
  {
    id: "uint8",
    label: "CPU Fast",
    detail: "UINT8",
    summary: "Fastest on CPU runtimes with 8-bit weights.",
  },
  {
    id: "q4f16",
    label: "GPU Boost",
    detail: "Q4F16",
    summary: "4-bit weights with F16 accumulation on WebGPU.",
  },
];

const MEMORY_OPTIONS: Array<{
  id: MemoryMode;
  label: string;
  detail: string;
  summary: string;
}> = [
  {
    id: "auto",
    label: "Release after run",
    detail: "Lower memory",
    summary: "Unload the model once the output is ready.",
  },
  {
    id: "keep",
    label: "Keep model loaded",
    detail: "Faster reruns",
    summary: "Hold the model in memory for quick repeats.",
  },
];

const TILE_MODE_OPTIONS: Array<{
  id: TileMode;
  label: string;
  summary: string;
}> = [
  {
    id: "full",
    label: "Full image",
    summary: "Single pass for smaller images.",
  },
  {
    id: "tiled",
    label: "Tiled",
    summary: "Split into tiles to reduce memory use.",
  },
];

const TILE_SIZE_OPTIONS: Array<{
  value: number;
  label: string;
  summary: string;
}> = [
  {
    value: 256,
    label: "256px",
    summary: "Lowest memory use.",
  },
  {
    value: 384,
    label: "384px",
    summary: "Balanced for mid-size images.",
  },
  {
    value: 512,
    label: "512px",
    summary: "Default balance of speed and memory.",
  },
  {
    value: 768,
    label: "768px",
    summary: "Fewer tiles, more memory.",
  },
  {
    value: 1024,
    label: "1024px",
    summary: "Best for large GPUs.",
  },
];

const TILE_OVERLAP_OPTIONS: Array<{
  value: number;
  label: string;
  summary: string;
}> = [
  {
    value: 16,
    label: "16px",
    summary: "Fastest, may show seams.",
  },
  {
    value: 32,
    label: "32px",
    summary: "Default seam reduction.",
  },
  {
    value: 48,
    label: "48px",
    summary: "Smoother transitions.",
  },
  {
    value: 64,
    label: "64px",
    summary: "Best for heavy textures.",
  },
];

const RUNTIME_OPTIONS: Array<{
  id: RuntimeMode;
  label: string;
  summary: string;
}> = [
  {
    id: "webgpu",
    label: "WebGPU",
    summary: "Fastest on supported GPUs.",
  },
  {
    id: "wasm",
    label: "WASM",
    summary: "CPU runtime with multi-threading when available.",
  },
];

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const formatDimensions = (dimensions: { width: number; height: number } | null) => {
  if (!dimensions) return "-";
  return `${dimensions.width} x ${dimensions.height}px`;
};

type PreviewCardProps = {
  label: string;
  src: string | null;
  sizeLabel?: string;
  helper?: string;
  onOpen?: () => void;
};

type PreviewItem = {
  label: string;
  src: string | null;
  sizeLabel?: string;
  dimensions: { width: number; height: number } | null;
  helper: string;
};

function PreviewCard({ label, src, sizeLabel, helper, onOpen }: PreviewCardProps) {
  const isInteractive = Boolean(onOpen);
  return (
    <div className="flex min-h-[300px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4 sm:min-h-[340px] lg:min-h-[420px]">
      <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
        <span className="font-semibold uppercase tracking-wide">{label}</span>
        {sizeLabel ? <span>{sizeLabel}</span> : null}
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={!isInteractive}
        aria-label={isInteractive ? `Open ${label.toLowerCase()} preview` : undefined}
        className={cn(
          "group relative mt-3 flex flex-1 items-center justify-center rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3 text-left transition-colors disabled:cursor-default disabled:opacity-100",
          isInteractive
            ? "cursor-zoom-in hover:bg-[color:var(--glass-hover-bg)]"
            : "cursor-default"
        )}
      >
        {src ? (
          <NextImage
            src={src}
            alt={`${label} preview`}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="rounded-[12px] object-contain"
            unoptimized
          />
        ) : (
          <p className="text-sm text-[color:var(--text-secondary)]">
            {helper ?? "No preview yet."}
          </p>
        )}
        {isInteractive ? (
          <span className="absolute bottom-3 right-3 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] opacity-0 transition-opacity group-hover:opacity-100">
            View
          </span>
        ) : null}
      </button>
    </div>
  );
}

const getWasmThreadCount = () => {
  if (typeof window === "undefined") return 1;
  const supportsThreads =
    typeof SharedArrayBuffer !== "undefined" && window.crossOriginIsolated;
  const cores = navigator.hardwareConcurrency ?? 4;
  return supportsThreads ? Math.max(1, cores) : 1;
};

const checkWebGpuFp16Support = async () => {
  if (typeof navigator === "undefined") return false;
  type WebGpuAdapter = { features?: { has?: (value: string) => boolean } };
  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter?: () => Promise<WebGpuAdapter | null> };
  }).gpu;
  if (!gpu?.requestAdapter) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter?.features?.has?.("shader-f16"));
  } catch {
    return false;
  }
};

const formatBoolean = (value: boolean | null) => {
  if (value === null) return "-";
  return value ? "Yes" : "No";
};

const formatErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
    try {
      return JSON.stringify(err);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const formatThreadLabel = (value: number | null) => {
  if (value === null) return "-";
  return value > 1 ? `${value} (multi)` : "1 (single)";
};

const getDtypeForPrecision = (
  precision: PrecisionMode
): PipelineDtype => precision;

const createUpscaleWorker = () => new Worker(new URL("./worker.ts", import.meta.url));

const MODEL_RELEASE_MESSAGE = "Model unloaded to save memory.";

const getPipelineKey = (
  modelId: UpscaleModelId,
  precision: PrecisionMode,
  runtime: RuntimeMode
) => `${modelId}:${precision}:${runtime}`;

const formatDeviceLabel = (device: RuntimeMode) =>
  device === "webgpu" ? "WebGPU" : "WASM";

const DTYPE_LABELS: Record<PipelineDtype, string> = {
  fp32: "FP32",
  q4: "Q4",
  uint8: "UINT8",
  q4f16: "Q4F16",
};

const formatDtypeLabel = (dtype: PipelineDtype) => DTYPE_LABELS[dtype];

const renderRawImage = async (raw: RawImage) => {
  const canvas = document.createElement("canvas");
  canvas.width = raw.width;
  canvas.height = raw.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }
  const rgba = new Uint8ClampedArray(raw.width * raw.height * 4);
  if (raw.channels === 4) {
    rgba.set(raw.data);
  } else {
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
  }
  context.putImageData(new ImageData(rgba, raw.width, raw.height), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("Unable to render output image."));
        return;
      }
      resolve(result);
    }, "image/png");
  });
  return { blob, url: URL.createObjectURL(blob) };
};

const clampTileConfig = (tile: TileConfig) => {
  const size = Math.max(64, Math.round(tile.size));
  const overlap = Math.max(0, Math.min(Math.round(tile.overlap), Math.floor(size / 2)));
  return { size, overlap };
};

const loadImageDataFromUrl = async (url: string) => {
  const image = new window.Image();
  image.decoding = "async";
  image.src = url;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to read this image."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
};

export default function AnimeUpscaleTool() {
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [inputSize, setInputSize] = useState<number | null>(null);
  const [inputDimensions, setInputDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [outputDimensions, setOutputDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [modelId, setModelId] = useState<UpscaleModelId>("2x");
  const [precisionMode, setPrecisionMode] = useState<PrecisionMode>("fp32");
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("wasm");
  const [memoryMode, setMemoryMode] = useState<MemoryMode>("auto");
  const [tileMode, setTileMode] = useState<TileMode>("full");
  const [tileSize, setTileSize] = useState(512);
  const [tileOverlap, setTileOverlap] = useState(32);
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<RuntimeDiagnostics>({
    hasWebGPU: null,
    webgpuFp16: null,
    webgpuFp16Enabled: null,
    crossOriginIsolated: null,
    sharedArrayBuffer: null,
    hardwareConcurrency: null,
    wasmThreads: null,
  });
  const [loadedInfo, setLoadedInfo] = useState<{
    modelId: UpscaleModelId;
    precision: PrecisionMode;
    device: RuntimeMode;
    dtype: PipelineDtype;
  } | null>(null);
  const [modelStatus, setModelStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [modelMessage, setModelMessage] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const workerCacheRef = useRef<{ key: string } | null>(null);
  const workerRunIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const viewerScrollLockRef = useRef<string | null>(null);
  const hasWebGPU = runtimeDiagnostics.hasWebGPU ?? false;
  const q4f16Blocked =
    precisionMode === "q4f16" &&
    (runtimeMode !== "webgpu" ||
      !hasWebGPU ||
      runtimeDiagnostics.webgpuFp16 === false);

  useEffect(() => {
    if (!inputUrl) return;
    return () => {
      URL.revokeObjectURL(inputUrl);
    };
  }, [inputUrl]);

  useEffect(() => {
    if (!outputUrl) return;
    return () => {
      URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      workerCacheRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const nextHasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
    const nextCrossOriginIsolated =
      typeof window !== "undefined" ? Boolean(window.crossOriginIsolated) : false;
    const nextSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
    const nextHardwareConcurrency =
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? null : null;
    const nextWasmThreads = getWasmThreadCount();
    setRuntimeDiagnostics({
      hasWebGPU: nextHasWebGPU,
      webgpuFp16: nextHasWebGPU ? null : false,
      webgpuFp16Enabled: nextHasWebGPU ? null : false,
      crossOriginIsolated: nextCrossOriginIsolated,
      sharedArrayBuffer: nextSharedArrayBuffer,
      hardwareConcurrency: nextHardwareConcurrency,
      wasmThreads: nextWasmThreads,
    });
    const checkFp16Support = async () => {
      if (!nextHasWebGPU) return;
      try {
        const supported = await checkWebGpuFp16Support();
        if (cancelled) return;
        setRuntimeDiagnostics((current) => ({
          ...current,
          webgpuFp16: supported,
        }));
      } catch {
        if (cancelled) return;
        setRuntimeDiagnostics((current) => ({
          ...current,
          webgpuFp16: false,
        }));
      }
    };
    void checkFp16Support();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (runtimeMode === "webgpu") return;
    setRuntimeDiagnostics((current) => ({
      ...current,
      webgpuFp16Enabled: null,
    }));
  }, [runtimeMode]);

  useEffect(() => {
    if (!hasWebGPU) return;
    setRuntimeMode((current) => (current === "wasm" ? "webgpu" : current));
  }, [hasWebGPU]);

  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((model) => model.id === modelId) ?? MODEL_OPTIONS[0],
    [modelId]
  );

  const expectedDimensions = useMemo(() => {
    if (!inputDimensions) return null;
    return {
      width: inputDimensions.width * selectedModel.scale,
      height: inputDimensions.height * selectedModel.scale,
    };
  }, [inputDimensions, selectedModel.scale]);

  const tileSettings = useMemo(() => {
    if (tileMode !== "tiled") return null;
    return clampTileConfig({ size: tileSize, overlap: tileOverlap });
  }, [tileMode, tileOverlap, tileSize]);

  const tileSummaryLabel = tileSettings
    ? `${tileSettings.size}px tiles · ${tileSettings.overlap}px overlap`
    : "Full image";

  const outputSummary = outputDimensions
    ? `Output ${formatDimensions(outputDimensions)}`
    : expectedDimensions
      ? `Expected ${formatDimensions(expectedDimensions)}`
      : "No output yet";

  const loadedLabel = useMemo(() => {
    if (!loadedInfo) return null;
    const modelLabel =
      MODEL_OPTIONS.find((model) => model.id === loadedInfo.modelId)?.label ??
      loadedInfo.modelId;
    const precisionLabel =
      PRECISION_OPTIONS.find((option) => option.id === loadedInfo.precision)
        ?.label ?? loadedInfo.precision;
    const deviceLabel = formatDeviceLabel(loadedInfo.device);
    const dtypeLabel = formatDtypeLabel(loadedInfo.dtype);
    return `${modelLabel} · ${precisionLabel} · ${deviceLabel} · ${dtypeLabel}`;
  }, [loadedInfo]);

  const statusLabel = useMemo(() => {
    if (isUpscaling) {
      if (modelMessage && modelMessage !== MODEL_RELEASE_MESSAGE) return modelMessage;
      return "Upscaling image...";
    }
    if (modelStatus === "loading") {
      const progressLabel =
        modelProgress !== null ? ` (${Math.min(modelProgress, 100)}%)` : "";
      return `${modelMessage ?? "Loading model..."}${progressLabel}`;
    }
    if (modelStatus === "ready") {
      return loadedLabel ? `Loaded: ${loadedLabel}` : "Model loaded and ready.";
    }
    if (modelStatus === "error") return "Model failed to load.";
    if (q4f16Blocked) return "Q4F16 requires WebGPU with F16 support.";
    if (modelMessage) return modelMessage;
    return inputUrl ? "Ready to load the model." : "Load an image to begin.";
  }, [
    inputUrl,
    isUpscaling,
    loadedLabel,
    modelMessage,
    modelProgress,
    modelStatus,
    q4f16Blocked,
  ]);

  const previewItems = useMemo<PreviewItem[]>(
    () => [
      {
        label: "Original",
        src: inputUrl,
        sizeLabel: inputSize ? formatBytes(inputSize) : undefined,
        dimensions: inputDimensions,
        helper: "Load an image to preview it.",
      },
      {
        label: "Upscaled",
        src: outputUrl,
        sizeLabel: outputSize ? formatBytes(outputSize) : undefined,
        dimensions: outputDimensions ?? expectedDimensions,
        helper: outputUrl ? "Upscaled output ready." : "Click upscale to generate output.",
      },
    ],
    [
      expectedDimensions,
      inputDimensions,
      inputSize,
      inputUrl,
      outputDimensions,
      outputSize,
      outputUrl,
    ]
  );

  const previewCount = previewItems.length;
  const canOpenViewer = Boolean(inputUrl || outputUrl);
  const activePreview = previewItems[viewerIndex] ?? previewItems[0];

  const openViewerAt = (index: number) => {
    if (!canOpenViewer) return;
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handleViewerPrev = () => {
    setViewerIndex((current) => (current - 1 + previewCount) % previewCount);
  };

  const handleViewerNext = () => {
    setViewerIndex((current) => (current + 1) % previewCount);
  };

  useEffect(() => {
    if (!viewerOpen || typeof document === "undefined") return;
    viewerScrollLockRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (typeof document === "undefined") return;
      document.body.style.overflow = viewerScrollLockRef.current ?? "";
      viewerScrollLockRef.current = null;
    };
  }, [viewerOpen]);

  useEffect(() => {
    if (!viewerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setViewerOpen(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setViewerIndex((current) => (current - 1 + previewCount) % previewCount);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setViewerIndex((current) => (current + 1) % previewCount);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewCount, viewerOpen]);

  useEffect(() => {
    if (viewerIndex < previewCount) return;
    setViewerIndex(0);
  }, [previewCount, viewerIndex]);

  const updatePipelineStateFromCache = (
    nextModelId: UpscaleModelId,
    nextPrecision: PrecisionMode,
    nextRuntime: RuntimeMode
  ) => {
    const cacheKey = getPipelineKey(nextModelId, nextPrecision, nextRuntime);
    const hasWorkerCache =
      workerRef.current && workerCacheRef.current?.key === cacheKey;
    setModelStatus(hasWorkerCache ? "ready" : "idle");
    setLoadedInfo(
      hasWorkerCache
        ? {
            modelId: nextModelId,
            precision: nextPrecision,
            device: nextRuntime,
            dtype: getDtypeForPrecision(nextPrecision),
          }
        : null
    );
  };

  const disposeWorkerCache = () => {
    if (!workerRef.current) return false;
    workerRef.current.terminate();
    workerRef.current = null;
    workerCacheRef.current = null;
    return true;
  };

  const releaseModelCache = (message: string | null, force = false) => {
    const releasedWorker = disposeWorkerCache();
    if (!releasedWorker && !force) return;
    setModelStatus("idle");
    setLoadedInfo(null);
    setModelProgress(null);
    setModelMessage(message);
  };

  const resetOutput = () => {
    setOutputUrl(null);
    setOutputSize(null);
    setOutputDimensions(null);
  };

  const clearAll = () => {
    resetOutput();
    setInputUrl(null);
    setInputSize(null);
    setInputDimensions(null);
    setError(null);
    setIsDragActive(false);
    setViewerOpen(false);
    if (inputRef.current) inputRef.current.value = "";
    if (modelMessage === MODEL_RELEASE_MESSAGE) {
      setModelMessage(null);
    }
  };

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    resetOutput();
    setError(null);
    setIsDragActive(false);
    setInputSize(file.size);
    const url = URL.createObjectURL(file);
    setInputUrl(url);
    setInputDimensions(null);

    const image = new window.Image();
    image.onload = () => {
      setInputDimensions({ width: image.width, height: image.height });
    };
    image.onerror = () => {
      setError("Unable to read this image.");
    };
    image.src = url;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    loadFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    loadFile(file);
  };

  const runWorkerUpscale = async (
    url: string,
    tile: TileConfig | null,
    runtime: RuntimeMode
  ) => {
    if (runtime === "webgpu" && !hasWebGPU) {
      throw new Error("WebGPU is not available in this browser. Switch to WASM.");
    }
    setModelStatus("loading");
    setModelMessage("Preparing worker...");
    setModelProgress(null);
    const imageData = await loadImageDataFromUrl(url);
    const runId = workerRunIdRef.current + 1;
    workerRunIdRef.current = runId;
    const useSharedWorker = memoryMode === "keep";
    const worker = useSharedWorker
      ? workerRef.current ?? createUpscaleWorker()
      : createUpscaleWorker();
    if (useSharedWorker && !workerRef.current) {
      workerRef.current = worker;
    }
    return new Promise<RawImage>((resolve, reject) => {
      const cleanup = (forceTerminate: boolean) => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        worker.removeEventListener("messageerror", handleMessageError);
        if (!useSharedWorker || forceTerminate) {
          worker.terminate();
          if (useSharedWorker) {
            workerRef.current = null;
            workerCacheRef.current = null;
          }
        }
      };
      const handleError = (event: Event | ErrorEvent) => {
        cleanup(true);
        const errorEvent = event as ErrorEvent;
        const errorObject =
          errorEvent?.error instanceof Error ? errorEvent.error : null;
        const parts = [
          errorEvent?.message ? `message: ${errorEvent.message}` : null,
          errorObject?.message ? `error: ${errorObject.message}` : null,
          errorEvent?.filename ? `file: ${errorEvent.filename}` : null,
          typeof errorEvent?.lineno === "number"
            ? `line: ${errorEvent.lineno}`
            : null,
          typeof errorEvent?.colno === "number"
            ? `col: ${errorEvent.colno}`
            : null,
        ].filter(Boolean);
        const details = parts.length ? `Worker error (${parts.join(", ")})` : "Worker crashed.";
        console.error("Worker error event", event, errorObject?.stack ?? errorObject);
        reject(new Error(details));
      };
      const handleMessage = (event: MessageEvent<WorkerResponseMessage>) => {
        const data = event.data;
        if (data.type === "progress") {
          if (data.id !== runId) return;
          if (typeof data.progress === "number") {
            setModelProgress(Math.min(data.progress, 100));
          }
          if (data.status) {
            setModelMessage(data.status);
          }
          return;
        }
        if (data.type === "diagnostics") {
          if (data.id !== runId) return;
          const nextFp16Enabled = data.webgpuFp16Enabled;
          if (typeof nextFp16Enabled === "boolean") {
            setRuntimeDiagnostics((current) => ({
              ...current,
              webgpuFp16Enabled: nextFp16Enabled,
            }));
          }
          return;
        }
        if (data.type === "error") {
          if (data.id !== runId && data.id !== -1) return;
          cleanup(true);
          reject(new Error(data.message));
          return;
        }
        if (data.id !== runId) return;
        const output = data.output;
        cleanup(false);
        resolve({
          data: output.data,
          width: output.width,
          height: output.height,
          channels: output.channels,
        });
      };
      const handleMessageError = () => {
        cleanup(true);
        reject(new Error("Worker message could not be deserialized."));
      };
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.addEventListener("messageerror", handleMessageError);
      const message: WorkerRunRequest = {
        type: "run",
        id: runId,
        runtime,
        modelId: selectedModel.modelId,
        dtype: getDtypeForPrecision(precisionMode),
        image: {
          width: imageData.width,
          height: imageData.height,
          data: imageData.data,
        },
        scale: selectedModel.scale,
        tile: tile ?? undefined,
      };
      worker.postMessage(message, [imageData.data.buffer]);
    });
  };

  const handleUpscale = async () => {
    if (!inputUrl) return;
    setIsUpscaling(true);
    setError(null);
    let didUpscale = false;
    try {
      const result = await runWorkerUpscale(inputUrl, tileSettings, runtimeMode);
      didUpscale = true;
      const { blob, url } = await renderRawImage(result);
      resetOutput();
      setOutputUrl(url);
      setOutputSize(blob.size);
      setOutputDimensions({ width: result.width, height: result.height });
      if (memoryMode === "keep") {
        const cacheKey = getPipelineKey(modelId, precisionMode, runtimeMode);
        workerCacheRef.current = { key: cacheKey };
        setModelStatus("ready");
        setModelMessage(null);
        setModelProgress(null);
        setLoadedInfo({
          modelId,
          precision: precisionMode,
          device: runtimeMode,
          dtype: getDtypeForPrecision(precisionMode),
        });
      }
    } catch (err) {
      const message = formatErrorMessage(err, "Upscale failed.");
      console.error("Upscale failed", err);
      setError(message);
      setModelStatus("error");
      setModelMessage(null);
      setModelProgress(null);
    } finally {
      setIsUpscaling(false);
      if (memoryMode === "auto") {
        releaseModelCache(MODEL_RELEASE_MESSAGE, didUpscale);
      }
    }
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const link = document.createElement("a");
    link.href = outputUrl;
    link.download = `zenith-anime-upscale-${modelId}.png`;
    link.click();
  };

  const dropTitle = isDragActive
    ? "Drop image here"
    : inputUrl
      ? "Replace image"
      : "Choose an image";
  const dropSubtitle = isDragActive
    ? "Release to upload"
    : inputUrl
      ? "PNG, JPG, WebP"
      : "PNG, JPG, WebP · drag & drop or click";

  const modelBadge = `Scale ${selectedModel.scale}x`;
  const diagnosticItems = [
    {
      label: "Cross-origin isolated",
      value: formatBoolean(runtimeDiagnostics.crossOriginIsolated),
    },
    {
      label: "SharedArrayBuffer",
      value: formatBoolean(runtimeDiagnostics.sharedArrayBuffer),
    },
    {
      label: "WebGPU",
      value: formatBoolean(runtimeDiagnostics.hasWebGPU),
    },
    {
      label: "WebGPU F16 support",
      value: formatBoolean(runtimeDiagnostics.webgpuFp16),
    },
    {
      label: "WebGPU F16 enabled",
      value: formatBoolean(runtimeDiagnostics.webgpuFp16Enabled),
    },
    {
      label: "Hardware threads",
      value:
        runtimeDiagnostics.hardwareConcurrency !== null
          ? `${runtimeDiagnostics.hardwareConcurrency}`
          : "-",
    },
    {
      label: "WASM threads",
      value: formatThreadLabel(runtimeDiagnostics.wasmThreads),
    },
  ];

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                Source
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
              >
                Clear
              </button>
            </div>
            <label
              className={cn(
                "group flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-4 text-center text-sm text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]",
                inputUrl && "border-solid",
                isDragActive &&
                  "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div
                  className={cn(
                    "absolute -inset-1 rounded-[18px] border border-[color:var(--glass-border)] opacity-40",
                    !inputUrl && "zenith-pulse",
                    isDragActive && "border-[color:var(--accent-pink)] opacity-70"
                  )}
                />
                <div
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)] transition-transform duration-200 group-hover:-translate-y-0.5",
                    !inputUrl && "zenith-float",
                    isDragActive &&
                      "border-[color:var(--accent-pink)] text-[color:var(--accent-pink)]"
                  )}
                >
                  <UploadIcon className="h-5 w-5" />
                </div>
              </div>
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                {dropTitle}
              </span>
              <span className="text-xs text-[color:var(--text-secondary)]">
                {dropSubtitle}
              </span>
            </label>
            <div className="flex flex-wrap gap-3 text-xs text-[color:var(--text-secondary)]">
              <span>Original: {inputSize ? formatBytes(inputSize) : "-"}</span>
              <span>Dimensions: {formatDimensions(inputDimensions)}</span>
            </div>
            {error ? (
              <p className="text-xs text-rose-500/80">{error}</p>
            ) : (
              <p className="text-xs text-[color:var(--text-secondary)]">
                First run downloads the model from Hugging Face.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Run
                </p>
                <p
                  className="text-xs text-[color:var(--text-secondary)]"
                  role="status"
                  aria-live="polite"
                >
                  {statusLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                  {modelBadge}
                </span>
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                  {tileSummaryLabel}
                </span>
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                  {outputSummary}
                </span>
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                  {outputSize ? formatBytes(outputSize) : "No file yet"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleUpscale}
                disabled={
                  !inputUrl || isUpscaling || modelStatus === "loading" || q4f16Blocked
                }
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-semibold shadow-[0_12px_24px_-14px_rgba(255,45,85,0.55)] transition-colors",
                  inputUrl
                    ? "bg-[color:var(--accent-pink)] text-white"
                    : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                )}
              >
                {isUpscaling ? "Upscaling..." : "Upscale"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!outputUrl}
                className={cn(
                  "rounded-full border border-[color:var(--glass-border)] px-4 py-2 text-sm shadow-[var(--glass-shadow)] transition-colors",
                  outputUrl
                    ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                    : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                )}
              >
                Download
              </button>
            </div>
            {(modelStatus === "loading" || isUpscaling) && modelProgress !== null ? (
              <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--glass-recessed-bg)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent-pink)] transition-all"
                  style={{ width: `${Math.min(modelProgress, 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <PreviewCard
            label={previewItems[0].label}
            src={previewItems[0].src}
            sizeLabel={previewItems[0].sizeLabel}
            helper={previewItems[0].helper}
            onOpen={canOpenViewer ? () => openViewerAt(0) : undefined}
          />
          <PreviewCard
            label={previewItems[1].label}
            src={previewItems[1].src}
            sizeLabel={previewItems[1].sizeLabel}
            helper={previewItems[1].helper}
            onOpen={canOpenViewer ? () => openViewerAt(1) : undefined}
          />
        </div>
        <div className="flex flex-col gap-4 rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Model settings
            </p>
            <span className="text-xs text-[color:var(--text-secondary)]">
              {selectedModel.label}
            </span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Runtime
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {RUNTIME_OPTIONS.map((option) => {
                    const isActive = option.id === runtimeMode;
                    const isUnavailable = option.id === "webgpu" && !hasWebGPU;
                    const isDisabled =
                      isUpscaling || modelStatus === "loading" || isUnavailable;
                    const detail =
                      option.id === "webgpu" ? (hasWebGPU ? "GPU" : "Unavailable") : "CPU";
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (option.id === runtimeMode || isUnavailable) return;
                          const nextRuntime = option.id;
                          const nextPrecision =
                            precisionMode === "q4f16" && nextRuntime !== "webgpu"
                              ? "q4"
                              : precisionMode;
                          setRuntimeMode(nextRuntime);
                          if (nextPrecision !== precisionMode) {
                            setPrecisionMode(nextPrecision);
                          }
                          resetOutput();
                          setError(null);
                          setModelMessage(null);
                          setModelProgress(null);
                          updatePipelineStateFromCache(
                            modelId,
                            nextPrecision,
                            nextRuntime
                          );
                        }}
                        className={cn(
                          "rounded-[14px] border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
                            : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                          isDisabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {option.label}
                          </span>
                          <span className="text-xs text-[color:var(--text-secondary)]">
                            {detail}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {option.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  {hasWebGPU
                    ? "WebGPU uses GPU acceleration. WASM uses multi-threaded CPU when available."
                    : "WebGPU not available in this browser. WASM uses multi-threaded CPU when available."}
                </p>
              </div>
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Data type
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PRECISION_OPTIONS.map((option) => {
                    const isActive = option.id === precisionMode;
                    const isQ4F16 = option.id === "q4f16";
                    const q4f16Unavailable =
                      isQ4F16 &&
                      (runtimeMode !== "webgpu" ||
                        !hasWebGPU ||
                        runtimeDiagnostics.webgpuFp16 === false);
                    const isDisabled =
                      isUpscaling ||
                      modelStatus === "loading" ||
                      q4f16Unavailable;
                    const detail = isQ4F16
                      ? runtimeMode !== "webgpu"
                        ? "WebGPU only"
                        : !hasWebGPU
                          ? "Unavailable"
                          : runtimeDiagnostics.webgpuFp16 === null
                            ? "Checking..."
                            : runtimeDiagnostics.webgpuFp16
                              ? option.detail
                              : "Unsupported"
                      : option.detail;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (option.id === precisionMode) return;
                          setPrecisionMode(option.id);
                          resetOutput();
                          setError(null);
                          setModelMessage(null);
                          setModelProgress(null);
                          updatePipelineStateFromCache(modelId, option.id, runtimeMode);
                        }}
                        className={cn(
                          "rounded-[14px] border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
                            : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                          isDisabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {option.label}
                          </span>
                          <span className="text-xs text-[color:var(--text-secondary)]">
                            {detail}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {option.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Q4 is the fastest overall. Q4F16 targets WebGPU, FP32 keeps the best
                  detail, and UINT8 is fastest on CPU.
                </p>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Memory
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MEMORY_OPTIONS.map((option) => {
                    const isActive = option.id === memoryMode;
                    const isDisabled = isUpscaling || modelStatus === "loading";
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (option.id === memoryMode) return;
                          setMemoryMode(option.id);
                          if (option.id === "auto") {
                            releaseModelCache(MODEL_RELEASE_MESSAGE);
                          } else if (modelMessage === MODEL_RELEASE_MESSAGE) {
                            setModelMessage(null);
                          }
                        }}
                        className={cn(
                          "rounded-[14px] border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
                            : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                          isDisabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {option.label}
                          </span>
                          <span className="text-xs text-[color:var(--text-secondary)]">
                            {option.detail}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {option.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Auto release keeps memory low by unloading weights after each run.
                </p>
              </div>
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Tiled upscale
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {TILE_MODE_OPTIONS.map((option) => {
                    const isActive = option.id === tileMode;
                    const isDisabled = isUpscaling || modelStatus === "loading";
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (option.id === tileMode) return;
                          setTileMode(option.id);
                          resetOutput();
                          setError(null);
                          setModelMessage(null);
                          setModelProgress(null);
                        }}
                        className={cn(
                          "rounded-[14px] border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
                            : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                          isDisabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {option.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {option.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {tileMode === "tiled" ? (
                  <div className="mt-2 grid gap-3">
                    <div className="grid gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                        Tile size
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TILE_SIZE_OPTIONS.map((option) => {
                          const isActive = option.value === tileSize;
                          const isDisabled = isUpscaling || modelStatus === "loading";
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => {
                                if (option.value === tileSize) return;
                                setTileSize(option.value);
                                resetOutput();
                                setError(null);
                                setModelMessage(null);
                                setModelProgress(null);
                              }}
                              className={cn(
                                "rounded-[12px] border px-3 py-2 text-left transition-colors",
                                isActive
                                  ? "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
                                  : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                                isDisabled && "cursor-not-allowed opacity-60"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                                  {option.label}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                                {option.summary}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                        Overlap
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TILE_OVERLAP_OPTIONS.map((option) => {
                          const isActive = option.value === tileOverlap;
                          const isDisabled = isUpscaling || modelStatus === "loading";
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => {
                                if (option.value === tileOverlap) return;
                                setTileOverlap(option.value);
                                resetOutput();
                                setError(null);
                                setModelMessage(null);
                                setModelProgress(null);
                              }}
                              className={cn(
                                "rounded-[12px] border px-3 py-2 text-left transition-colors",
                                isActive
                                  ? "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
                                  : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                                isDisabled && "cursor-not-allowed opacity-60"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                                  {option.label}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                                {option.summary}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Tiled mode processes the image in smaller chunks to reduce memory.
                </p>
              </div>
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  Upscale model
                </p>
                <div className="grid gap-3">
                  {MODEL_OPTIONS.map((model) => {
                    const isActive = model.id === modelId;
                    const isDisabled = isUpscaling || modelStatus === "loading";
                    return (
                      <button
                        key={model.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (model.id === modelId) return;
                          setModelId(model.id);
                          resetOutput();
                          setError(null);
                          setModelMessage(null);
                          setModelProgress(null);
                          updatePipelineStateFromCache(
                            model.id,
                            precisionMode,
                            runtimeMode
                          );
                        }}
                        className={cn(
                          "rounded-[14px] border px-4 py-3 text-left transition-colors",
                          isActive
                            ? "border-[color:var(--accent-pink)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
                            : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                          isDisabled && "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {model.label}
                          </span>
                          <span className="text-xs text-[color:var(--text-secondary)]">
                            {model.scale}x
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {model.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 border-t border-[color:var(--glass-border)] pt-4 lg:grid-cols-2">
            <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
              <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
                Runtime diagnostics
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {diagnosticItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-2 rounded-[10px] bg-[color:var(--glass-bg)] px-2.5 py-1"
                  >
                    <span>{item.label}</span>
                    <span className="font-semibold text-[color:var(--text-primary)]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
                WASM multi-threading requires cross-origin isolation (COOP/COEP).
              </p>
            </div>
            <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
              <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
                Model source (Hugging Face)
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {MODEL_OPTIONS.map((model) => (
                  <a
                    key={model.id}
                    href={model.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--text-primary)] transition-colors hover:text-[color:var(--accent-pink)]"
                  >
                    {model.modelId}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {viewerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setViewerOpen(false)}
            aria-label="Close preview"
          />
          <div
            className="relative flex h-full w-full max-w-6xl flex-col gap-3 rounded-[24px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4 shadow-[0_24px_60px_-40px_rgba(15,20,25,0.65)] backdrop-blur-[24px]"
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  {activePreview.label}
                </p>
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {activePreview.sizeLabel ?? "No file yet"} -{" "}
                  {formatDimensions(activePreview.dimensions)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleViewerPrev}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] transition-transform hover:-translate-y-0.5"
                  aria-label="Previous image"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleViewerNext}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] transition-transform hover:-translate-y-0.5"
                  aria-label="Next image"
                >
                  <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-4 py-2 text-xs font-semibold text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-[18px] bg-[color:var(--glass-recessed-bg)]">
              {activePreview.src ? (
                <NextImage
                  src={activePreview.src}
                  alt={`${activePreview.label} preview`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <p className="text-sm text-[color:var(--text-secondary)]">
                  {activePreview.helper}
                </p>
              )}
              <button
                type="button"
                onClick={handleViewerPrev}
                className="group absolute inset-y-0 left-0 flex w-1/4 items-center justify-start text-[color:var(--text-primary)] transition-colors hover:bg-black/20"
                aria-label="Previous image"
              >
                <span className="ml-3 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] shadow-[var(--glass-shadow)] opacity-0 transition-opacity group-hover:opacity-100">
                  <ArrowLeftIcon className="h-4 w-4" />
                </span>
              </button>
              <button
                type="button"
                onClick={handleViewerNext}
                className="group absolute inset-y-0 right-0 flex w-1/4 items-center justify-end text-[color:var(--text-primary)] transition-colors hover:bg-black/20"
                aria-label="Next image"
              >
                <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] shadow-[var(--glass-shadow)] opacity-0 transition-opacity group-hover:opacity-100">
                  <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                </span>
              </button>
            </div>
            <p className="text-xs text-[color:var(--text-secondary)]">
              Use the arrow keys or click the left/right edges to switch images.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
