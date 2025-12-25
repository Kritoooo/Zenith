"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";

import { UploadIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

type UpscaleModelId = "2x" | "4x";

type ModelOption = {
  id: UpscaleModelId;
  label: string;
  scale: number;
  modelId: string;
  sourceUrl: string;
  summary: string;
};

type RawImage = {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
};

type UpscalePipeline = (input: string) => Promise<RawImage>;
type PipelineFactory = (
  task: string,
  model: string,
  options?: Record<string, unknown>
) => Promise<UpscalePipeline>;

type ModelProgressEvent = {
  status?: string;
  progress?: number;
  loaded?: number;
  total?: number;
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
};

function PreviewCard({ label, src, sizeLabel, helper }: PreviewCardProps) {
  return (
    <div className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
      <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
        <span className="font-semibold uppercase tracking-wide">{label}</span>
        {sizeLabel ? <span>{sizeLabel}</span> : null}
      </div>
      <div className="relative mt-3 flex flex-1 items-center justify-center rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3">
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
      </div>
    </div>
  );
}

const normalizeProgress = (event: ModelProgressEvent) => {
  if (typeof event.progress === "number") {
    return event.progress <= 1 ? Math.round(event.progress * 100) : Math.round(event.progress);
  }
  if (typeof event.loaded === "number" && typeof event.total === "number") {
    return Math.round((event.loaded / event.total) * 100);
  }
  return null;
};

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
  const [modelStatus, setModelStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [modelMessage, setModelMessage] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const pipelineRef = useRef<UpscalePipeline | null>(null);
  const pipelineModelRef = useRef<UpscaleModelId | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const outputSummary = outputDimensions
    ? `Output ${formatDimensions(outputDimensions)}`
    : expectedDimensions
      ? `Expected ${formatDimensions(expectedDimensions)}`
      : "No output yet";

  const statusLabel = useMemo(() => {
    if (isUpscaling) return "Upscaling image...";
    if (modelStatus === "loading") {
      const progressLabel =
        modelProgress !== null ? ` (${Math.min(modelProgress, 100)}%)` : "";
      return `${modelMessage ?? "Loading model..."}${progressLabel}`;
    }
    if (modelStatus === "ready") return "Model loaded and ready.";
    if (modelStatus === "error") return "Model failed to load.";
    return "Load an image to begin.";
  }, [isUpscaling, modelMessage, modelProgress, modelStatus]);

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
    if (inputRef.current) inputRef.current.value = "";
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

  const ensurePipeline = async (model: ModelOption) => {
    if (pipelineRef.current && pipelineModelRef.current === model.id) {
      return pipelineRef.current;
    }
    setModelStatus("loading");
    setModelMessage("Downloading model...");
    setModelProgress(null);
    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      const runtimeEnv = env as {
        allowLocalModels?: boolean;
        useBrowserCache?: boolean;
      };
      runtimeEnv.allowLocalModels = false;
      runtimeEnv.useBrowserCache = true;
      const createPipeline = pipeline as unknown as PipelineFactory;
      const upscaler = await createPipeline("image-to-image", model.modelId, {
        dtype: "fp32",
        progress_callback: (progress: ModelProgressEvent) => {
          const normalized = normalizeProgress(progress);
          if (normalized !== null) {
            setModelProgress(normalized);
          }
          if (progress.status) {
            setModelMessage(progress.status);
          }
        },
      });
      pipelineRef.current = upscaler;
      pipelineModelRef.current = model.id;
      setModelStatus("ready");
      setModelMessage(null);
      setModelProgress(null);
      return upscaler;
    } catch (err) {
      setModelStatus("error");
      setModelMessage(null);
      throw err;
    }
  };

  const handleUpscale = async () => {
    if (!inputUrl) return;
    setIsUpscaling(true);
    setError(null);
    try {
      const pipeline = await ensurePipeline(selectedModel);
      const result = await pipeline(inputUrl);
      const { blob, url } = await renderRawImage(result);
      resetOutput();
      setOutputUrl(url);
      setOutputSize(blob.size);
      setOutputDimensions({ width: result.width, height: result.height });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upscale failed.";
      setError(message);
    } finally {
      setIsUpscaling(false);
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
      : "PNG, JPG, WebP - drag and drop or click";

  const modelBadge = `Scale ${selectedModel.scale}x`;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Model
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                {modelBadge}
              </span>
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                {outputSummary}
              </span>
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                {outputSize ? formatBytes(outputSize) : "No file yet"}
              </span>
            </div>
          </div>
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
                    pipelineRef.current = null;
                    pipelineModelRef.current = null;
                    setModelStatus("idle");
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpscale}
              disabled={!inputUrl || isUpscaling || modelStatus === "loading"}
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
            <span className="text-xs text-[color:var(--text-secondary)]">
              {statusLabel}
            </span>
          </div>
          {modelStatus === "loading" && modelProgress !== null ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--glass-recessed-bg)]">
              <div
                className="h-full rounded-full bg-[color:var(--accent-pink)] transition-all"
                style={{ width: `${Math.min(modelProgress, 100)}%` }}
              />
            </div>
          ) : null}
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
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <PreviewCard
          label="Original"
          src={inputUrl}
          sizeLabel={inputSize ? formatBytes(inputSize) : undefined}
          helper="Load an image to preview it."
        />
        <PreviewCard
          label="Upscaled"
          src={outputUrl}
          sizeLabel={outputSize ? formatBytes(outputSize) : undefined}
          helper="Click upscale to generate output."
        />
      </div>
    </div>
  );
}
