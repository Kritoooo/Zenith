"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UploadIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

type OutputFormat = "image/jpeg" | "image/webp" | "image/png";

const FORMAT_LABELS: Record<OutputFormat, string> = {
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
  "image/png": "PNG",
};

const QUICK_PRESETS = [
  { label: "Crisp", quality: 0.92 },
  { label: "Balanced", quality: 0.82 },
  { label: "Small", quality: 0.7 },
];

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const parseLimit = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
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
      <div className="mt-3 flex flex-1 items-center justify-center rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3">
        {src ? (
          <img
            src={src}
            alt={`${label} preview`}
            className="max-h-full max-w-full rounded-[12px] object-contain"
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

export default function ImageCompressTool() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [quality, setQuality] = useState(0.82);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [maxWidth, setMaxWidth] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pending, setPending] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!originalUrl) return;
    return () => URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => {
    if (!compressedUrl) return;
    return () => URL.revokeObjectURL(compressedUrl);
  }, [compressedUrl]);

  const clearAll = () => {
    setOriginalUrl(null);
    setCompressedUrl(null);
    setOriginalSize(null);
    setCompressedSize(null);
    setDimensions(null);
    setError(null);
    setPending(false);
    setIsDragActive(false);
    if (inputRef.current) inputRef.current.value = "";
    imageRef.current = null;
  };

  const loadImage = (file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setOriginalSize(file.size);
    setCompressedUrl(null);
    setCompressedSize(null);
    setError(null);
    setPending(true);

    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setDimensions({ width: image.width, height: image.height });
      setPending(true);
      window.setTimeout(() => {
        compressImage();
      }, 0);
    };
    image.onerror = () => {
      setError("Unable to read this image.");
      imageRef.current = null;
    };
    image.src = url;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    loadImage(file);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please drop an image file.");
      return;
    }
    loadImage(file);
  };

  const computeTargetSize = (width: number, height: number) => {
    const maxW = parseLimit(maxWidth);
    const maxH = parseLimit(maxHeight);
    let scale = 1;
    if (maxW) scale = Math.min(scale, maxW / width);
    if (maxH) scale = Math.min(scale, maxH / height);
    scale = Math.min(scale, 1);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    return { width: targetWidth, height: targetHeight };
  };

  const compressImage = useCallback(async () => {
    const image = imageRef.current;
    if (!image) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { width, height } = computeTargetSize(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas is not available.");
      }
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) => {
        if (format === "image/png") {
          canvas.toBlob(resolve, format);
        } else {
          canvas.toBlob(resolve, format, quality);
        }
      });
      if (!blob) {
        throw new Error("Compression failed.");
      }
      const url = URL.createObjectURL(blob);
      setCompressedUrl(url);
      setCompressedSize(blob.size);
      setPending(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Compression failed.";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [format, maxHeight, maxWidth, quality]);

  const handleDownload = () => {
    if (!compressedUrl) return;
    const link = document.createElement("a");
    link.href = compressedUrl;
    const extension = format === "image/jpeg" ? "jpg" : format.split("/")[1];
    link.download = `zenith-compressed.${extension}`;
    link.click();
  };

  const sizeSummary = useMemo(() => {
    if (!originalSize || !compressedSize) return null;
    const delta = originalSize - compressedSize;
    const percent = Math.round((Math.abs(delta) / originalSize) * 100);
    const status = delta >= 0 ? `${percent}% smaller` : `${percent}% larger`;
    return `${formatBytes(compressedSize)} (${status})`;
  }, [compressedSize, originalSize]);

  const dimensionSummary = dimensions
    ? `${dimensions.width} × ${dimensions.height}px`
    : "—";
  const targetSummary = useMemo(() => {
    if (!dimensions) return "—";
    const target = computeTargetSize(dimensions.width, dimensions.height);
    return `${target.width} × ${target.height}px`;
  }, [dimensions, maxHeight, maxWidth]);
  const dropTitle = isDragActive
    ? "Drop image here"
    : originalUrl
      ? "Replace image"
      : "Choose an image";
  const dropSubtitle = isDragActive
    ? "Release to upload"
    : originalUrl
      ? "JPG, PNG, WebP"
      : "JPG, PNG, WebP · drag & drop or click";

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
              originalUrl && "border-solid",
              isDragActive &&
                "border-[color:var(--accent-blue)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
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
                  !originalUrl && "zenith-pulse",
                  isDragActive && "border-[color:var(--accent-blue)] opacity-70"
                )}
              />
              <div
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)] transition-transform duration-200 group-hover:-translate-y-0.5",
                  !originalUrl && "zenith-float",
                  isDragActive &&
                    "border-[color:var(--accent-blue)] text-[color:var(--accent-blue)]"
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
            <span>Original: {originalSize ? formatBytes(originalSize) : "—"}</span>
            <span>Dimensions: {dimensionSummary}</span>
          </div>
          {error ? (
            <p className="text-xs text-rose-500/80">{error}</p>
          ) : (
            <p className="text-xs text-[color:var(--text-secondary)]">
              {pending
                ? "Adjust settings then compress."
                : "Compression stays on-device."}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4 rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Settings
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                Target {targetSummary}
              </span>
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                {sizeSummary ?? "No output yet"}
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[color:var(--text-secondary)]">
              Format
              <select
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value as OutputFormat);
                  setPending(true);
                }}
                className="mt-2 w-full rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
              >
                {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[color:var(--text-secondary)]">
              Quality
              <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2">
                <input
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.02}
                  value={quality}
                  onChange={(event) => {
                    setQuality(Number(event.target.value));
                    setPending(true);
                  }}
                  disabled={format === "image/png"}
                  className="h-1 w-full accent-[color:var(--accent-orange)]"
                />
                <span className="text-xs text-[color:var(--text-secondary)]">
                  {format === "image/png" ? "Lossless" : Math.round(quality * 100)}
                </span>
              </div>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[color:var(--text-secondary)]">
              Max width (px)
              <input
                type="number"
                min={1}
                value={maxWidth}
                onChange={(event) => {
                  setMaxWidth(event.target.value);
                  setPending(true);
                }}
                placeholder="auto"
                className="mt-2 w-full rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
              />
            </label>
            <label className="text-xs text-[color:var(--text-secondary)]">
              Max height (px)
              <input
                type="number"
                min={1}
                value={maxHeight}
                onChange={(event) => {
                  setMaxHeight(event.target.value);
                  setPending(true);
                }}
                placeholder="auto"
                className="mt-2 w-full rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setQuality(preset.quality);
                  setPending(true);
                }}
                className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-xs text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={compressImage}
              disabled={!originalUrl || isProcessing}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)] transition-colors",
                originalUrl
                  ? "bg-[color:var(--accent-blue)] text-white"
                  : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
              )}
            >
              {isProcessing ? "Compressing..." : "Compress"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!compressedUrl}
              className={cn(
                "rounded-full border border-[color:var(--glass-border)] px-4 py-2 text-sm shadow-[var(--glass-shadow)] transition-colors",
                compressedUrl
                  ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                  : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
              )}
            >
              Download
            </button>
            {pending ? (
              <span className="text-xs text-[color:var(--text-secondary)]">
                Settings changed — recompress.
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <PreviewCard
          label="Original"
          src={originalUrl}
          sizeLabel={originalSize ? formatBytes(originalSize) : undefined}
          helper="Load an image to preview it."
        />
        <PreviewCard
          label="Compressed"
          src={compressedUrl}
          sizeLabel={compressedSize ? formatBytes(compressedSize) : undefined}
          helper="Click compress to generate output."
        />
      </div>
    </div>
  );
}
