"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { UploadIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

type DetectionVersion = "v5" | "v3";

type LanguageOption = {
  id: string;
  label: string;
  summary: string;
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
    label: "English",
    summary: "Latin letters, numbers, punctuation",
    detectionVersion: "v5",
    recPath: "languages/english/rec.onnx",
    dictPath: "languages/english/dict.txt",
    recSize: "7.5 MB",
  },
  {
    id: "latin",
    label: "Latin",
    summary: "FR / DE / ES / IT / PT",
    detectionVersion: "v5",
    recPath: "languages/latin/rec.onnx",
    dictPath: "languages/latin/dict.txt",
    recSize: "7.5 MB",
  },
  {
    id: "chinese",
    label: "Chinese / Japanese",
    summary: "CJK with mixed Latin",
    detectionVersion: "v5",
    recPath: "languages/chinese/rec.onnx",
    dictPath: "languages/chinese/dict.txt",
    recSize: "34.7 MB",
  },
  {
    id: "korean",
    label: "Korean",
    summary: "Hangul + Latin",
    detectionVersion: "v5",
    recPath: "languages/korean/rec.onnx",
    dictPath: "languages/korean/dict.txt",
    recSize: "11.0 MB",
  },
  {
    id: "greek",
    label: "Greek",
    summary: "Greek + Latin",
    detectionVersion: "v5",
    recPath: "languages/greek/rec.onnx",
    dictPath: "languages/greek/dict.txt",
    recSize: "7.5 MB",
  },
  {
    id: "thai",
    label: "Thai",
    summary: "Thai + Latin",
    detectionVersion: "v5",
    recPath: "languages/thai/rec.onnx",
    dictPath: "languages/thai/dict.txt",
    recSize: "7.6 MB",
  },
  {
    id: "eslav",
    label: "Cyrillic",
    summary: "RU / UA / BG / BY",
    detectionVersion: "v5",
    recPath: "languages/eslav/rec.onnx",
    dictPath: "languages/eslav/dict.txt",
    recSize: "7.6 MB",
  },
  {
    id: "arabic",
    label: "Arabic / Urdu / Persian",
    summary: "PP-OCRv3 recognition",
    detectionVersion: "v3",
    recPath: "languages/arabic/rec.onnx",
    dictPath: "languages/arabic/dict.txt",
    recSize: "7.9 MB",
  },
  {
    id: "hindi",
    label: "Hindi / Marathi / Nepali",
    summary: "PP-OCRv3 recognition",
    detectionVersion: "v3",
    recPath: "languages/hindi/rec.onnx",
    dictPath: "languages/hindi/dict.txt",
    recSize: "9.7 MB",
  },
  {
    id: "tamil",
    label: "Tamil",
    summary: "PP-OCRv3 recognition",
    detectionVersion: "v3",
    recPath: "languages/tamil/rec.onnx",
    dictPath: "languages/tamil/dict.txt",
    recSize: "2.3 MB",
  },
  {
    id: "telugu",
    label: "Telugu",
    summary: "PP-OCRv3 recognition",
    detectionVersion: "v3",
    recPath: "languages/telugu/rec.onnx",
    dictPath: "languages/telugu/dict.txt",
    recSize: "6.5 MB",
  },
];

const createOcrWorker = () => new Worker(new URL("./worker.ts", import.meta.url));

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

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
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);
  const [hasWorker, setHasWorker] = useState(false);
  const [copied, setCopied] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const workerRunIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    if (!imageData) return "Drop an image or click to upload.";
    if (phase === "loading") {
      const progressLabel = progress !== null ? ` ${progress}%` : "";
      return `${statusMessage ?? "Loading model"}${progressLabel}...`;
    }
    if (phase === "running") return statusMessage ?? "Running OCR...";
    if (phase === "ready" && duration !== null) {
      return `OCR complete in ${duration} ms.`;
    }
    return "Ready to recognize text.";
  }, [duration, error, imageData, phase, progress, statusMessage]);

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
    setPhase("idle");
    try {
      const { imageData: nextImageData, width, height } =
        await loadImageDataFromFile(file);
      setImageData(nextImageData);
      setImageSize({ width, height });
    } catch (err) {
      setError(formatErrorMessage(err, "Unable to read this image."));
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
      setError("Upload an image before running OCR.");
      setPhase("error");
      return;
    }
    if (webgpuAvailable === false) {
      setError("WebGPU is not available in this browser.");
      setPhase("error");
      return;
    }
    setError(null);
    setLines([]);
    setItems([]);
    setText("");
    setConfidence(null);
    setDuration(null);
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
      setError(formatErrorMessage(err, "OCR failed. Please try again."));
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
      setError(formatErrorMessage(err, "Copy failed."));
    }
  };

  const lineBoxes = lines.length ? lines : items;
  const hasResults = text.length > 0 || lineBoxes.length > 0;
  const isBusy = phase === "loading" || phase === "running";
  const webgpuStatus =
    webgpuAvailable === null ? "checking" : webgpuAvailable ? "ready" : "needed";

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
            Recognize
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
            {copied ? "Copied" : "Copy text"}
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
            Clear
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
          <label className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
            <span>Language</span>
            <select
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
                setPhase("idle");
              }}
              disabled={isBusy}
              className="bg-transparent text-[color:var(--text-primary)] outline-none"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1",
              webgpuAvailable === false
                ? "bg-amber-500/10"
                : "bg-[color:var(--glass-bg)]"
            )}
          >
            WebGPU {webgpuStatus}
          </span>
          <span
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1",
              hasWorker
                ? "bg-[color:var(--glass-bg)]"
                : "bg-[color:var(--glass-recessed-bg)]"
            )}
          >
            Model {hasWorker ? "warm" : "idle"}
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
            Unload
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
            <span className="font-semibold uppercase tracking-wide">Input</span>
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
                <img
                  src={imageUrl}
                  alt="Uploaded preview"
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
                  Drop an image, or click to upload
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                  PNG, JPG, or WEBP works best.
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
              Show boxes
            </label>
            <span>{hasResults ? `${lineBoxes.length} boxes` : "No boxes yet"}</span>
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
            <span className="font-semibold uppercase tracking-wide">Result</span>
            {confidence !== null ? (
              <span>Confidence {formatPercent(confidence)}</span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-3 rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3">
            {text ? (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--text-primary)]">
                {text}
              </pre>
            ) : (
              <p className="text-sm text-[color:var(--text-secondary)]">
                Run OCR to extract text.
              </p>
            )}
            {lines.length ? (
              <div className="grid gap-2">
                {lines.map((line, index) => (
                  <div
                    key={`${line.text}-${index}`}
                    className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
                      <span>Line {index + 1}</span>
                      <span>{formatPercent(line.confidence)}</span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--text-primary)]">
                      {line.text}
                    </p>
                    <p className="mt-1 text-[10px] text-[color:var(--text-secondary)]">
                      {line.count} segments
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
            Model source (Hugging Face)
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
            Detection: {detectionModel.label} ({detectionModel.size}) + Recognition:{" "}
            {selectedLanguage.recSize}
          </p>
          <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
            {selectedLanguage.label}: {selectedLanguage.summary}
          </p>
        </div>
        <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
            Usage notes
          </p>
          <p className="mt-2">
            WebGPU is required. Use a Chromium browser with WebGPU enabled.
          </p>
          <p className="mt-2">
            Larger models take longer to download the first time. Files are cached
            by the browser after the initial run.
          </p>
          <p className="mt-2">
            Line boxes are approximate. Use confidence as a heuristic, not a guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}
