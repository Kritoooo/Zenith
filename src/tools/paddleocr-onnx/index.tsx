"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Select } from "@/components/Select";
import { UploadIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

type DetectionVersion = "v5" | "v3";

type LanguageOption = {
  id: string;
  labelKey: string;
  summaryKey: string;
  detectionVersion: DetectionVersion;
  recPath: string;
  dictPath: string;
  recSize: string;
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

type WorkerImagePayload = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type WorkerRunRequest = {
  type: "run";
  id: number;
  image: WorkerImagePayload;
  model: {
    detectionPath: string;
    recognitionPath: string;
    dictPath: string;
  };
};

type WorkerProgressMessage = {
  type: "progress";
  id: number;
  progress?: number | null;
  status?: string | null;
};

type WorkerDiagnosticsMessage = {
  type: "diagnostics";
  id: number;
  webgpuAvailable: boolean;
};

type WorkerResultMessage = {
  type: "result";
  id: number;
  text: string;
  confidence: number;
  duration: number;
  lines: OcrLine[];
  items: RecognitionResult[];
};

type WorkerErrorMessage = {
  type: "error";
  id: number;
  message: string;
};

type WorkerMessage =
  | WorkerProgressMessage
  | WorkerDiagnosticsMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

const MODEL_URL = "https://huggingface.co/monkt/paddleocr-onnx";

const DETECTION_MODELS: Record<
  DetectionVersion,
  { path: string; size: string; label: string }
> = {
  v5: {
    path: "detection/v5/det.onnx",
    size: "84 MB",
    label: "PP-OCRv5",
  },
  v3: {
    path: "detection/v3/det.onnx",
    size: "2.3 MB",
    label: "PP-OCRv3",
  },
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: "english",
    labelKey: "languages.english.label",
    summaryKey: "languages.english.summary",
    detectionVersion: "v5",
    recPath: "languages/english/rec.onnx",
    dictPath: "languages/english/dict.txt",
    recSize: "7.5 MB",
  },
  {
    id: "latin",
    labelKey: "languages.latin.label",
    summaryKey: "languages.latin.summary",
    detectionVersion: "v5",
    recPath: "languages/latin/rec.onnx",
    dictPath: "languages/latin/dict.txt",
    recSize: "7.5 MB",
  },
  {
    id: "chinese",
    labelKey: "languages.chinese.label",
    summaryKey: "languages.chinese.summary",
    detectionVersion: "v5",
    recPath: "languages/chinese/rec.onnx",
    dictPath: "languages/chinese/dict.txt",
    recSize: "34.7 MB",
  },
  {
    id: "korean",
    labelKey: "languages.korean.label",
    summaryKey: "languages.korean.summary",
    detectionVersion: "v5",
    recPath: "languages/korean/rec.onnx",
    dictPath: "languages/korean/dict.txt",
    recSize: "11.0 MB",
  },
  {
    id: "greek",
    labelKey: "languages.greek.label",
    summaryKey: "languages.greek.summary",
    detectionVersion: "v5",
    recPath: "languages/greek/rec.onnx",
    dictPath: "languages/greek/dict.txt",
    recSize: "7.5 MB",
  },
  {
    id: "thai",
    labelKey: "languages.thai.label",
    summaryKey: "languages.thai.summary",
    detectionVersion: "v5",
    recPath: "languages/thai/rec.onnx",
    dictPath: "languages/thai/dict.txt",
    recSize: "7.6 MB",
  },
  {
    id: "eslav",
    labelKey: "languages.cyrillic.label",
    summaryKey: "languages.cyrillic.summary",
    detectionVersion: "v5",
    recPath: "languages/eslav/rec.onnx",
    dictPath: "languages/eslav/dict.txt",
    recSize: "7.6 MB",
  },
  {
    id: "arabic",
    labelKey: "languages.arabic.label",
    summaryKey: "languages.arabic.summary",
    detectionVersion: "v3",
    recPath: "languages/arabic/rec.onnx",
    dictPath: "languages/arabic/dict.txt",
    recSize: "7.9 MB",
  },
  {
    id: "hindi",
    labelKey: "languages.hindi.label",
    summaryKey: "languages.hindi.summary",
    detectionVersion: "v3",
    recPath: "languages/hindi/rec.onnx",
    dictPath: "languages/hindi/dict.txt",
    recSize: "9.7 MB",
  },
  {
    id: "tamil",
    labelKey: "languages.tamil.label",
    summaryKey: "languages.tamil.summary",
    detectionVersion: "v3",
    recPath: "languages/tamil/rec.onnx",
    dictPath: "languages/tamil/dict.txt",
    recSize: "2.3 MB",
  },
  {
    id: "telugu",
    labelKey: "languages.telugu.label",
    summaryKey: "languages.telugu.summary",
    detectionVersion: "v3",
    recPath: "languages/telugu/rec.onnx",
    dictPath: "languages/telugu/dict.txt",
    recSize: "6.5 MB",
  },
];

const createOcrWorker = () => new Worker(new URL("./worker.ts", import.meta.url));

const clampConfidence = (value: number) => Math.min(1, Math.max(0, value));

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.6;

const toPercent = (value: number) => {
  if (!Number.isFinite(value)) return null;
  return Math.round(clampConfidence(value) * 100);
};

const formatPercent = (value: number) => {
  const percent = toPercent(value);
  if (percent === null) return "—";
  return `${percent}%`;
};

const MAX_VISIBLE_LINES = 8;

const getConfidenceLabel = (
  value: number,
  labels: { unknown: string; high: string; medium: string; low: string }
) => {
  if (!Number.isFinite(value)) return labels.unknown;
  const normalized = clampConfidence(value);
  if (normalized >= HIGH_CONFIDENCE_THRESHOLD) return labels.high;
  if (normalized >= LOW_CONFIDENCE_THRESHOLD) return labels.medium;
  return labels.low;
};

const getConfidenceColor = (value: number) => {
  if (!Number.isFinite(value)) return "var(--text-secondary)";
  const normalized = clampConfidence(value);
  if (normalized >= HIGH_CONFIDENCE_THRESHOLD) return "var(--accent-green)";
  if (normalized >= LOW_CONFIDENCE_THRESHOLD) return "var(--accent-orange)";
  return "var(--accent-pink)";
};

const formatErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
  }
  return fallback;
};

const loadImageDataFromFile = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return {
    imageData,
    width: canvas.width,
    height: canvas.height,
  };
};

export default function PaddleOcrTool() {
  const t = useTranslations("tools.paddleocr-onnx.ui");
  const [selectedLanguageId, setSelectedLanguageId] = useState("english");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "ready" | "error">(
    "idle"
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<OcrLine[]>([]);
  const [items, setItems] = useState<RecognitionResult[]>([]);
  const [text, setText] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showAllLines, setShowAllLines] = useState(false);
  const [showLowConfidenceOnly, setShowLowConfidenceOnly] = useState(false);
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState(
    DEFAULT_LOW_CONFIDENCE_THRESHOLD
  );
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);
  const [hasWorker, setHasWorker] = useState(false);
  const [copied, setCopied] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const workerRunIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const errorMap = useMemo<Record<string, string>>(
    () => ({
      "Worker unavailable.": t("errors.workerUnavailable"),
      "Worker crashed.": t("errors.workerCrashed"),
      "Unable to read this image.": t("errors.readImage"),
      "Canvas is not available.": t("errors.canvas"),
      "Upload an image before running OCR.": t("errors.noImage"),
      "WebGPU is not available in this browser.": t("errors.webgpuUnavailable"),
      "OCR failed. Please try again.": t("errors.ocrFailed"),
      "Copy failed.": t("errors.copyFailed"),
    }),
    [t]
  );
  const localizeError = (message: string) => errorMap[message] ?? message;
  const confidenceLabels = useMemo(
    () => ({
      unknown: t("labels.confidenceUnknown"),
      high: t("labels.confidenceHigh"),
      medium: t("labels.confidenceMedium"),
      low: t("labels.confidenceLow"),
    }),
    [t]
  );

  const selectedLanguage = useMemo(() => {
    return (
      LANGUAGE_OPTIONS.find((option) => option.id === selectedLanguageId) ??
      LANGUAGE_OPTIONS[0]
    );
  }, [selectedLanguageId]);

  const detectionModel = DETECTION_MODELS[selectedLanguage.detectionVersion];

  const modelConfig = useMemo(
    () => ({
      detectionPath: detectionModel.path,
      recognitionPath: selectedLanguage.recPath,
      dictPath: selectedLanguage.dictPath,
    }),
    [detectionModel.path, selectedLanguage.dictPath, selectedLanguage.recPath]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebgpuAvailable(Boolean((navigator as Navigator & { gpu?: unknown })?.gpu));
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const statusLine = useMemo(() => {
    if (error) return error;
    if (!imageData) return t("status.needImage");
    if (phase === "loading") {
      const progressLabel = progress !== null ? ` ${progress}%` : "";
      const base = statusMessage ?? t("status.loadingBase");
      return t("status.loading", { status: base, progress: progressLabel });
    }
    if (phase === "running") return statusMessage ?? t("status.running");
    if (phase === "ready" && duration !== null) {
      return t("status.complete", { ms: duration });
    }
    return t("status.ready");
  }, [duration, error, imageData, phase, progress, statusMessage, t]);

  const lineStats = useMemo(() => {
    if (!lines.length) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let total = 0;
    let count = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const line of lines) {
      if (!Number.isFinite(line.confidence)) continue;
      const normalized = clampConfidence(line.confidence);
      total += normalized;
      count += 1;
      if (normalized < min) min = normalized;
      if (normalized > max) max = normalized;
      if (normalized >= HIGH_CONFIDENCE_THRESHOLD) high += 1;
      else if (normalized >= LOW_CONFIDENCE_THRESHOLD) medium += 1;
      else low += 1;
    }
    if (!count) return null;
    return {
      avg: total / count,
      min,
      max,
      high,
      medium,
      low,
    };
  }, [lines]);

  const filteredLines = useMemo(() => {
    const entries = lines.map((line, index) => ({ line, index }));
    if (!showLowConfidenceOnly) return entries;
    return entries.filter(({ line }) => {
      if (!Number.isFinite(line.confidence)) return false;
      return clampConfidence(line.confidence) < lowConfidenceThreshold;
    });
  }, [lines, lowConfidenceThreshold, showLowConfidenceOnly]);

  const visibleLines = useMemo(() => {
    if (showAllLines) return filteredLines;
    return filteredLines.slice(0, MAX_VISIBLE_LINES);
  }, [filteredLines, showAllLines]);

  const runWorker = (image: WorkerImagePayload, config: WorkerRunRequest["model"]) => {
    if (!workerRef.current) {
      workerRef.current = createOcrWorker();
      setHasWorker(true);
    }
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("Worker unavailable."));
    }
    const runId = (workerRunIdRef.current += 1);
    return new Promise<WorkerResultMessage>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;
        if (!data || data.id !== runId) return;
        if (data.type === "progress") {
          const status = data.status ?? null;
          if (status?.toLowerCase().includes("running")) {
            setPhase("running");
          } else {
            setPhase("loading");
          }
          setProgress(data.progress ?? null);
          setStatusMessage(status);
          return;
        }
        if (data.type === "diagnostics") {
          setWebgpuAvailable(data.webgpuAvailable);
          return;
        }
        if (data.type === "result") {
          cleanup();
          resolve(data);
          return;
        }
        if (data.type === "error") {
          cleanup();
          reject(new Error(data.message));
        }
      };
      const handleError = () => {
        cleanup();
        reject(new Error("Worker crashed."));
      };
      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
      };
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage({
        type: "run",
        id: runId,
        image,
        model: config,
      });
    });
  };

  const handleFile = async (file: File) => {
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setImageData(null);
    setImageSize(null);
    setError(null);
    setLines([]);
    setItems([]);
    setText("");
    setConfidence(null);
    setDuration(null);
    setShowAllLines(false);
    setShowLowConfidenceOnly(false);
    setPhase("idle");
    try {
      const { imageData: nextImageData, width, height } =
        await loadImageDataFromFile(file);
      setImageData(nextImageData);
      setImageSize({ width, height });
    } catch (err) {
      setError(
        localizeError(formatErrorMessage(err, "Unable to read this image."))
      );
      setPhase("error");
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isBusy) return;
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (isBusy) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleFile(file);
  };

  const runOcr = async () => {
    if (!imageData) {
      setError(t("errors.noImage"));
      setPhase("error");
      return;
    }
    if (webgpuAvailable === false) {
      setError(t("errors.webgpuUnavailable"));
      setPhase("error");
      return;
    }
    setError(null);
    setLines([]);
    setItems([]);
    setText("");
    setConfidence(null);
    setDuration(null);
    setShowAllLines(false);
    setShowLowConfidenceOnly(false);
    setProgress(null);
    setStatusMessage(null);
    setPhase("loading");
    try {
      const bufferCopy = new Uint8ClampedArray(imageData.data);
      const response = await runWorker(
        {
          width: imageData.width,
          height: imageData.height,
          data: bufferCopy,
        },
        modelConfig
      );
      setLines(response.lines ?? []);
      setItems(response.items ?? []);
      setText(response.text ?? "");
      setConfidence(response.confidence ?? null);
      setDuration(response.duration ?? null);
      setPhase("ready");
    } catch (err) {
      setError(
        localizeError(formatErrorMessage(err, "OCR failed. Please try again."))
      );
      setPhase("error");
    }
  };

  const clearAll = () => {
    setImageData(null);
    setImageSize(null);
    setLines([]);
    setItems([]);
    setText("");
    setConfidence(null);
    setDuration(null);
    setError(null);
    setProgress(null);
    setStatusMessage(null);
    setPhase("idle");
    setImageUrl(null);
    setShowAllLines(false);
    setShowLowConfidenceOnly(false);
  };

  const unloadModel = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: "dispose",
        id: workerRunIdRef.current + 1,
      });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setHasWorker(false);
    setProgress(null);
    setStatusMessage(null);
    setPhase("idle");
  };

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      setError(localizeError(formatErrorMessage(err, "Copy failed.")));
    }
  };

  const lineBoxes = lines.length ? lines : items;
  const hasResults = text.length > 0 || lineBoxes.length > 0;
  const isBusy = phase === "loading" || phase === "running";
  const webgpuStatus =
    webgpuAvailable === null ? "checking" : webgpuAvailable ? "ready" : "needed";
  const hasHiddenLines = filteredLines.length > MAX_VISIBLE_LINES;
  const hasLowConfidenceLines = lines.some((line) => {
    if (!Number.isFinite(line.confidence)) return false;
    return clampConfidence(line.confidence) < lowConfidenceThreshold;
  });
  const totalLinesCount = lines.length;
  const filteredLinesCount = filteredLines.length;
  const visibleLinesCount = visibleLines.length;
  const linesSummary = useMemo(() => {
    if (showLowConfidenceOnly) {
      if (!filteredLinesCount) return t("labels.noLowLines");
      if (showAllLines) {
        return t("labels.lowOfTotal", {
          low: filteredLinesCount,
          total: totalLinesCount,
        });
      }
      return t("labels.showingLow", {
        visible: visibleLinesCount,
        low: filteredLinesCount,
      });
    }
    if (showAllLines) return t("labels.totalLines", { count: totalLinesCount });
    return t("labels.showingLines", {
      visible: visibleLinesCount,
      total: totalLinesCount,
    });
  }, [
    filteredLinesCount,
    showAllLines,
    showLowConfidenceOnly,
    t,
    totalLinesCount,
    visibleLinesCount,
  ]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runOcr}
            disabled={isBusy}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold shadow-[0_12px_24px_-14px_rgba(0,122,255,0.55)] transition-colors",
              isBusy
                ? "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                : "bg-[color:var(--accent-blue)] text-white hover:brightness-110"
            )}
          >
            {t("actions.recognize")}
          </button>
          <button
            type="button"
            onClick={copyText}
            disabled={!text || isBusy}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-2 text-sm shadow-[var(--glass-shadow)] transition-colors",
              !text || isBusy
                ? "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
            )}
          >
            {copied ? t("actions.copied") : t("actions.copy")}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={isBusy}
            className={cn(
              "rounded-full px-3 py-2 text-sm transition-colors",
              isBusy
                ? "cursor-not-allowed text-[color:var(--text-secondary)]"
                : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
            )}
          >
            {t("actions.clear")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
            <span id="ocr-language-label">{t("labels.language")}</span>
            <Select
              value={selectedLanguageId}
              onChange={(event) => {
                setSelectedLanguageId(event.target.value);
                setLines([]);
                setItems([]);
                setText("");
                setConfidence(null);
                setDuration(null);
                setProgress(null);
                setStatusMessage(null);
                setShowAllLines(false);
                setShowLowConfidenceOnly(false);
                setPhase("idle");
              }}
              disabled={isBusy}
              variant="ghost"
              aria-labelledby="ocr-language-label"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(option.labelKey)}
                </option>
              ))}
            </Select>
          </div>
          <span
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1",
              webgpuAvailable === false
                ? "bg-amber-500/10"
                : "bg-[color:var(--glass-bg)]"
            )}
          >
            {t("labels.webgpu", {
              status: t(`labels.webgpuStatus.${webgpuStatus}`),
            })}
          </span>
          <span
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1",
              hasWorker
                ? "bg-[color:var(--glass-bg)]"
                : "bg-[color:var(--glass-recessed-bg)]"
            )}
          >
            {t("labels.model", {
              status: hasWorker
                ? t("labels.modelWarm")
                : t("labels.modelIdle"),
            })}
          </span>
          <button
            type="button"
            onClick={unloadModel}
            disabled={!hasWorker}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1 transition-colors",
              hasWorker
                ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
            )}
          >
            {t("actions.unload")}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <p
          className={cn(
            "min-h-[1.25rem] text-xs",
            error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
          )}
          aria-live="polite"
        >
          {statusLine}
        </p>
        {phase === "loading" || phase === "running" ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--glass-recessed-bg)]">
            <div
              className="h-full rounded-full bg-[color:var(--accent-blue)] transition-all"
              style={{ width: `${progress ?? 18}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[280px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wide">
              {t("labels.input")}
            </span>
            {imageSize ? (
              <span>
                {imageSize.width} x {imageSize.height}px
              </span>
            ) : null}
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault();
              if (isBusy) return;
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onClick={() => {
              if (isBusy) return;
              inputRef.current?.click();
            }}
            className={cn(
              "mt-3 flex min-h-[220px] flex-1 cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed px-3 py-6 text-center text-sm transition",
              isDragActive
                ? "border-[color:var(--accent-blue)] bg-[color:var(--glass-hover-bg)]"
                : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)]"
            )}
          >
            {imageUrl ? (
              <div className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={t("aria.uploadPreview")}
                  className="h-auto w-full rounded-[12px]"
                />
                {showBoxes && lineBoxes.length > 0 && imageSize ? (
                  <svg
                    className="pointer-events-none absolute inset-0 text-[color:var(--accent-blue)]"
                    viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {lineBoxes.map((line, index) => (
                      <rect
                        key={`${line.text}-${index}`}
                        x={line.box.x}
                        y={line.box.y}
                        width={line.box.width}
                        height={line.box.height}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)]">
                  <UploadIcon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[color:var(--text-primary)]">
                  {t("labels.uploadPrompt")}
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                  {t("labels.uploadHint")}
                </p>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showBoxes}
                onChange={(event) => setShowBoxes(event.target.checked)}
                disabled={!hasResults}
              />
              {t("labels.showBoxes")}
            </label>
            <span>
              {hasResults
                ? t("labels.boxCount", { count: lineBoxes.length })
                : t("labels.noBoxes")}
            </span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
        <div className="flex min-h-[280px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wide">
              {t("labels.result")}
            </span>
            {confidence !== null ? (
              <span className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-secondary)]">
                  {t("labels.overall")}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: getConfidenceColor(confidence) }}
                >
                  {formatPercent(confidence)}
                </span>
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-3 rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3">
            {confidence !== null || lineStats ? (
              <div className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
                  <span className="font-semibold uppercase tracking-wide">
                    {t("labels.confidence")}
                  </span>
                  {confidence !== null ? (
                    <span className="flex items-center gap-2">
                      <span style={{ color: getConfidenceColor(confidence) }}>
                        {getConfidenceLabel(confidence, confidenceLabels)}
                      </span>
                      <span className="text-[color:var(--text-primary)]">
                        {formatPercent(confidence)}
                      </span>
                    </span>
                  ) : null}
                </div>
                {confidence !== null ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[color:var(--glass-recessed-bg)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${toPercent(confidence) ?? 0}%`,
                        backgroundColor: getConfidenceColor(confidence),
                      }}
                    />
                  </div>
                ) : null}
                {lineStats ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[color:var(--text-secondary)]">
                    <span>
                      {t("stats.avg", { value: formatPercent(lineStats.avg) })}
                    </span>
                    <span>
                      {t("stats.range", {
                        min: formatPercent(lineStats.min),
                        max: formatPercent(lineStats.max),
                      })}
                    </span>
                    <span>
                      {t("stats.counts", {
                        high: lineStats.high,
                        medium: lineStats.medium,
                        low: lineStats.low,
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            {text ? (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--text-primary)]">
                {text}
              </pre>
            ) : (
              <p className="text-sm text-[color:var(--text-secondary)]">
                {t("hints.run")}
              </p>
            )}
            {lines.length ? (
              <div className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
                  <span className="font-semibold uppercase tracking-wide">
                    {t("labels.lines")}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllLines(false);
                        setShowLowConfidenceOnly((prev) => !prev);
                      }}
                      disabled={!hasLowConfidenceLines}
                      className={cn(
                        "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-[var(--glass-shadow)] transition-colors",
                        showLowConfidenceOnly
                          ? "bg-[color:var(--accent-blue)] text-white shadow-[0_10px_20px_-12px_rgba(0,122,255,0.65)] hover:brightness-110 hover:text-white"
                          : "bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]",
                        hasLowConfidenceLines ? "" : "cursor-not-allowed opacity-50"
                      )}
                    >
                      {t("actions.filterLow", {
                        threshold: formatPercent(lowConfidenceThreshold),
                      })}
                    </button>
                    <label className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
                      <span>{t("labels.threshold")}</span>
                      <input
                        type="range"
                        min={30}
                        max={95}
                        step={5}
                        value={toPercent(lowConfidenceThreshold) ?? 60}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) return;
                          setLowConfidenceThreshold(value / 100);
                        }}
                        aria-label={t("aria.lowConfidenceThreshold")}
                        className="h-1 w-20 cursor-pointer accent-[color:var(--accent-blue)]"
                      />
                      <span className="text-[color:var(--text-primary)]">
                        {formatPercent(lowConfidenceThreshold)}
                      </span>
                    </label>
                    <span>{linesSummary}</span>
                    {hasHiddenLines ? (
                      <button
                        type="button"
                        onClick={() => setShowAllLines((prev) => !prev)}
                        className="rounded-full border border-[color:var(--glass-border)] px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
                      >
                        {showAllLines ? t("actions.showLess") : t("actions.showAll")}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 max-h-[320px] overflow-y-auto pr-1">
                  <div className="grid gap-2">
                    {visibleLines.map(({ line, index }) => {
                      const toneColor = getConfidenceColor(line.confidence);
                      return (
                        <div
                          key={`${line.text}-${index}`}
                          className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2"
                        >
                          <div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: toneColor }}
                              />
                              {t("labels.line", { index: index + 1 })}
                            </span>
                            <span
                              className="font-semibold"
                              style={{ color: toneColor }}
                            >
                              {formatPercent(line.confidence)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--glass-bg)]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${toPercent(line.confidence) ?? 0}%`,
                                backgroundColor: toneColor,
                              }}
                            />
                          </div>
                          <p className="mt-2 text-sm text-[color:var(--text-primary)]">
                            {line.text}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-[color:var(--text-secondary)]">
                            <span>
                              {t("labels.segments", { count: line.count })}
                            </span>
                            <span>
                              {getConfidenceLabel(line.confidence, confidenceLabels)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
            {t("labels.modelSource")}
          </p>
          <a
            href={MODEL_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-[color:var(--text-primary)] transition-colors hover:text-[color:var(--accent-blue)]"
          >
            monkt/paddleocr-onnx
          </a>
          <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
            {t("labels.detection")}: {detectionModel.label} ({detectionModel.size}) +{" "}
            {t("labels.recognition")}: {selectedLanguage.recSize}
          </p>
          <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
            {t(selectedLanguage.labelKey)}: {t(selectedLanguage.summaryKey)}
          </p>
        </div>
        <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
            {t("labels.usageNotes")}
          </p>
          <p className="mt-2">{t("labels.usageNote1")}</p>
          <p className="mt-2">{t("labels.usageNote2")}</p>
          <p className="mt-2">{t("labels.usageNote3")}</p>
        </div>
      </div>
    </div>
  );
}
