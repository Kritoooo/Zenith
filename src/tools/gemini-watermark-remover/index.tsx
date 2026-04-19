"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import NextImage from "next/image";

import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { UploadIcon } from "@/components/Icons";
import { Select } from "@/components/Select";
import { ToolPanel } from "@/components/ToolPanel";
import { cn } from "@/lib/cn";
import {
  preloadWatermarkMasks,
  removeGeminiVisibleWatermark,
  type WatermarkMode,
} from "@/tools/gemini-watermark-remover/core";
import { formatBytes } from "@/lib/formatBytes";

type PreviewCardProps = {
  label: string;
  alt: string;
  src: string | null;
  sizeLabel?: string;
  helper?: string;
};

type ResultSummary = {
  maskLabel: string;
  regionLabel: string;
};

function PreviewCard({ label, alt, src, sizeLabel, helper }: PreviewCardProps) {
  return (
    <ToolPanel
      title={label}
      actions={sizeLabel ? <span>{sizeLabel}</span> : null}
      headerClassName="flex items-center justify-between text-xs text-[color:var(--text-secondary)]"
      className="min-h-[260px]"
    >
      <div className="relative mt-3 flex flex-1 items-center justify-center rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3">
        {src ? (
          <NextImage
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="rounded-[12px] object-contain"
            unoptimized
          />
        ) : (
          <p className="text-sm text-[color:var(--text-secondary)]">{helper}</p>
        )}
      </div>
    </ToolPanel>
  );
}

function buildDownloadName(filename: string | null) {
  const fallback = "zenith-gemini-clean";
  if (!filename) return `${fallback}.png`;
  const base = filename.replace(/\.[^.]+$/, "") || fallback;
  return `${base}-clean.png`;
}

export default function GeminiWatermarkRemoverTool() {
  const t = useTranslations("tools.gemini-watermark-remover.ui");
  const [mode, setMode] = useState<WatermarkMode>("auto");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pending, setPending] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const getErrorMessage = (message: string) => {
    switch (message) {
      case "NO_CANVAS":
        return t("errors.canvas");
      case "MASK_LOAD_FAILED":
        return t("errors.mask");
      case "OUTPUT_BLOB_FAILED":
        return t("errors.process");
      default:
        return t("errors.process");
    }
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const jobIdRef = useRef(0);
  const loadIdRef = useRef(0);

  useEffect(() => {
    void preloadWatermarkMasks();
  }, []);

  useEffect(() => {
    if (!originalUrl) return;
    return () => URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => {
    if (!resultUrl) return;
    return () => URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  const runRemoval = async (
    image = imageRef.current,
    nextMode = mode,
    nextDimensions = dimensions
  ) => {
    if (!image || !nextDimensions) return;

    const jobId = ++jobIdRef.current;
    setIsProcessing(true);
    setError(null);

    try {
      const result = await removeGeminiVisibleWatermark(
        image,
        nextDimensions.width,
        nextDimensions.height,
        nextMode
      );

      if (jobId !== jobIdRef.current) {
        return;
      }

      const url = URL.createObjectURL(result.blob);
      setResultUrl(url);
      setResultSize(result.blob.size);
      setResultSummary({
        maskLabel: `${result.spec.size} × ${result.spec.size}px`,
        regionLabel: result.region
          ? `${result.region.width} × ${result.region.height}px @ (${result.region.x}, ${result.region.y})`
          : t("stats.empty"),
      });
      setPending(false);
    } catch (err) {
      if (jobId !== jobIdRef.current) {
        return;
      }

      if (err instanceof Error) {
        setError(getErrorMessage(err.message));
      } else {
        setError(t("errors.process"));
      }
      setPending(false);
    } finally {
      if (jobId === jobIdRef.current) {
        setIsProcessing(false);
      }
    }
  };

  const clearAll = () => {
    loadIdRef.current += 1;
    jobIdRef.current += 1;
    setOriginalUrl(null);
    setResultUrl(null);
    setOriginalSize(null);
    setResultSize(null);
    setDimensions(null);
    setResultSummary(null);
    setFilename(null);
    setError(null);
    setPending(false);
    setIsDragActive(false);
    imageRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  };

  const loadImage = (file: File) => {
    jobIdRef.current += 1;
    imageRef.current = null;
    setDimensions(null);
    const loadId = ++loadIdRef.current;
    const url = URL.createObjectURL(file);

    setOriginalUrl(url);
    setResultUrl(null);
    setOriginalSize(file.size);
    setResultSize(null);
    setFilename(file.name);
    setResultSummary(null);
    setError(null);
    setPending(true);

    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      if (loadId !== loadIdRef.current) {
        return;
      }

      imageRef.current = image;
      const nextDimensions = { width: image.width, height: image.height };
      setDimensions(nextDimensions);
      void runRemoval(image, mode, nextDimensions);
    };
    image.onerror = () => {
      if (loadId !== loadIdRef.current) {
        return;
      }

      setError(t("errors.read"));
      setPending(false);
      imageRef.current = null;
    };
    image.src = url;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("errors.selectImage"));
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
      setError(t("errors.dropImage"));
      return;
    }
    loadImage(file);
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = buildDownloadName(filename);
    link.click();
  };

  const dropTitle = isDragActive
    ? t("drop.dropHere")
    : originalUrl
      ? t("drop.replace")
      : t("drop.choose");

  const dropSubtitle = isDragActive
    ? t("drop.release")
    : originalUrl
      ? t("drop.formats")
      : t("drop.formatsHint");

  const dimensionSummary = dimensions
    ? `${dimensions.width} × ${dimensions.height}px`
    : t("stats.empty");

  const outputSummary = useMemo(() => {
    if (!resultSize) return t("stats.empty");
    return `${formatBytes(resultSize)} · PNG`;
  }, [resultSize, t]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <ToolPanel
          title={t("labels.source")}
          actions={
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              {t("actions.clear")}
            </button>
          }
          headerClassName="flex items-center justify-between"
          className="flex flex-col gap-4"
        >
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
            <span className="text-xs text-[color:var(--text-secondary)]">{dropSubtitle}</span>
          </label>

          <div className="flex flex-wrap gap-3 text-xs text-[color:var(--text-secondary)]">
            <span>
              {t("stats.original")}: {originalSize ? formatBytes(originalSize) : t("stats.empty")}
            </span>
            <span>
              {t("stats.dimensions")}: {dimensionSummary}
            </span>
          </div>

          {error ? (
            <p className="text-xs text-rose-500/80">{error}</p>
          ) : (
            <p className="text-xs text-[color:var(--text-secondary)]">
              {pending ? t("status.processing") : t("status.localOnly")}
            </p>
          )}
        </ToolPanel>

        <ToolPanel
          title={t("labels.settings")}
          actions={
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                {t("stats.mask")}: {resultSummary?.maskLabel ?? t("stats.empty")}
              </span>
              <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
                {t("stats.output")}: {outputSummary}
              </span>
            </div>
          }
          headerClassName="flex flex-wrap items-center justify-between gap-2"
          className="flex flex-col gap-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-xs text-[color:var(--text-secondary)]">
              <span id="gemini-watermark-mode-label" className="block">
                {t("labels.mode")}
              </span>
              <Select
                value={mode}
                onChange={(event) => {
                  const nextMode = event.target.value as WatermarkMode;
                  setMode(nextMode);
                  if (!imageRef.current || !dimensions) return;
                  setPending(true);
                  void runRemoval(imageRef.current, nextMode, dimensions);
                }}
                className="mt-2"
                buttonClassName="rounded-[12px]"
                aria-labelledby="gemini-watermark-mode-label"
              >
                <option value="auto">{t("modes.auto")}</option>
                <option value="small">{t("modes.small")}</option>
                <option value="large">{t("modes.large")}</option>
              </Select>
            </div>

            <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
              <p className="font-medium text-[color:var(--text-primary)]">{t("labels.region")}</p>
              <p className="mt-1">{resultSummary?.regionLabel ?? t("stats.empty")}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
              <p className="font-medium text-[color:var(--text-primary)]">{t("labels.behavior")}</p>
              <p className="mt-1">{t("notes.reverseBlend")}</p>
            </div>
            <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
              <p className="font-medium text-[color:var(--text-primary)]">{t("labels.output")}</p>
              <p className="mt-1">{t("notes.png")}</p>
            </div>
            <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
              <p className="font-medium text-[color:var(--text-primary)]">{t("labels.scope")}</p>
              <p className="mt-1">{t("notes.visibleOnly")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={() => void runRemoval()} disabled={!originalUrl || isProcessing}>
              {isProcessing ? t("actions.removing") : t("actions.remove")}
            </PrimaryButton>
            <SecondaryButton onClick={handleDownload} disabled={!resultUrl}>
              {t("actions.download")}
            </SecondaryButton>
            {pending ? (
              <span className="text-xs text-[color:var(--text-secondary)]">{t("status.pending")}</span>
            ) : null}
          </div>
        </ToolPanel>
      </div>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <PreviewCard
          label={t("labels.original")}
          alt={t("aria.originalPreview")}
          src={originalUrl}
          sizeLabel={originalSize ? formatBytes(originalSize) : undefined}
          helper={t("helpers.original")}
        />
        <PreviewCard
          label={t("labels.cleaned")}
          alt={t("aria.cleanedPreview")}
          src={resultUrl}
          sizeLabel={resultSize ? formatBytes(resultSize) : undefined}
          helper={t("helpers.cleaned")}
        />
      </div>
    </div>
  );
}
