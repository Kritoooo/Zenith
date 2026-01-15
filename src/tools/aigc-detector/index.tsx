"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { ToolPanel } from "@/components/ToolPanel";
import { cn } from "@/lib/cn";

type ClassificationResult = {
  label: string;
  score: number;
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
  results: ClassificationResult[];
  duration: number;
};

type WorkerErrorMessage = {
  type: "error";
  id: number;
  message: string;
};

type WorkerMessage =
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

type AnalysisStats = {
  chars: number;
  duration: number;
};

const MODEL_ID = "krito2025/aigc-detector-zh-onnx";
const MODEL_URL = "https://huggingface.co/krito2025/aigc-detector-zh-onnx";
const MAX_CHUNK_CHARS = 512;
const DEFAULT_CHUNK_CHARS = 400;

const createDetectorWorker = () =>
  new Worker(new URL("./worker.ts", import.meta.url));

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatLabel = (label: string, unknownLabel: string, labelPrefix: string) => {
  const cleaned = label.trim();
  if (!cleaned) return unknownLabel;
  if (/^LABEL_\d+$/i.test(cleaned)) {
    return `${labelPrefix} ${cleaned.split("_")[1]}`;
  }
  return cleaned;
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

const sanitizeInput = (value: string) => value.replace(/\s+/g, "");

const parseChunkSize = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const clampChunkSize = (value: number | null) => {
  if (value === null) return DEFAULT_CHUNK_CHARS;
  return Math.min(MAX_CHUNK_CHARS, Math.max(1, value));
};

export default function AigcDetectorTool() {
  const t = useTranslations("tools.aigc-detector.ui");
  const sampleText = t("sample");
  const [input, setInput] = useState(sampleText);
  const [chunkSizeInput, setChunkSizeInput] = useState(
    String(DEFAULT_CHUNK_CHARS)
  );
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "loading" | "running" | "ready" | "error"
  >("idle");
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [modelMessage, setModelMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasWorker, setHasWorker] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const workerRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const charCount = input.length;
  const parsedChunkSize = parseChunkSize(chunkSizeInput);
  const effectiveChunkSize = clampChunkSize(parsedChunkSize);
  const isChunked = charCount > effectiveChunkSize;
  const isBusy = phase === "running" || phase === "loading";

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [results]);

  const topResult = sortedResults[0];

  const statusLine = useMemo(() => {
    if (error) return error;
    if (phase === "loading") {
      const progressLabel = modelProgress !== null ? ` ${modelProgress}%` : "";
      return `${modelMessage ?? t("status.loading")}${progressLabel}...`;
    }
    if (phase === "running") return t("status.running");
    if (phase === "ready" && analysisStats) {
      return t("status.complete", { ms: analysisStats.duration });
    }
    return t("status.idle");
  }, [analysisStats, error, modelMessage, modelProgress, phase, t]);

  const runWorker = (text: string, chunkSize: number) => {
    if (!workerRef.current) {
      workerRef.current = createDetectorWorker();
      setHasWorker(true);
    }
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("WORKER_UNAVAILABLE"));
    }
    const runId = (workerRunIdRef.current += 1);
    return new Promise<WorkerResultMessage>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;
        if (!data || data.id !== runId) return;
        if (data.type === "progress") {
          setPhase("loading");
          setModelProgress(data.progress ?? null);
          setModelMessage(data.status ?? null);
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
        reject(new Error("WORKER_CRASHED"));
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
        modelId: MODEL_ID,
        text,
        chunkSize,
      });
    });
  };

  const analyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError(t("errors.empty"));
      setPhase("error");
      return;
    }
    setError(null);
    setResults([]);
    setAnalysisStats(null);
    setModelProgress(null);
    setModelMessage(null);
    setPhase("running");
    const payload = sanitizeInput(trimmed);
    try {
      const response = await runWorker(payload, effectiveChunkSize);
      setResults(response.results ?? []);
      setAnalysisStats({
        chars: payload.length,
        duration: response.duration,
      });
      setPhase("ready");
    } catch (err) {
      if (err instanceof Error && err.message === "WORKER_UNAVAILABLE") {
        setError(t("errors.worker"));
      } else if (err instanceof Error && err.message === "WORKER_CRASHED") {
        setError(t("errors.workerCrashed"));
      } else {
        setError(formatErrorMessage(err, t("errors.failed")));
      }
      setPhase("error");
    }
  };

  const clearAll = () => {
    setInput("");
    setResults([]);
    setAnalysisStats(null);
    setError(null);
    setModelProgress(null);
    setModelMessage(null);
    setPhase("idle");
  };

  const loadSample = () => {
    setInput(sampleText);
    setResults([]);
    setAnalysisStats(null);
    setError(null);
    setPhase("idle");
  };

  const unloadModel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setHasWorker(false);
    setModelProgress(null);
    setModelMessage(null);
    setPhase("idle");
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={analyze}
            disabled={isBusy}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold shadow-[0_12px_24px_-14px_rgba(52,199,89,0.55)] transition-colors",
              isBusy
                ? "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                : "bg-[color:var(--accent-green)] text-white hover:brightness-110"
            )}
          >
            {t("actions.analyze")}
          </button>
          <button
            type="button"
            onClick={loadSample}
            disabled={isBusy}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-2 text-sm shadow-[var(--glass-shadow)] transition-colors",
              isBusy
                ? "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
            )}
          >
            {t("actions.sample")}
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
          <label className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
            <span>{t("labels.chunk")}</span>
            <input
              type="number"
              min={1}
              max={MAX_CHUNK_CHARS}
              value={chunkSizeInput}
              onChange={(event) => setChunkSizeInput(event.target.value)}
              onBlur={() =>
                setChunkSizeInput(String(clampChunkSize(parseChunkSize(chunkSizeInput))))
              }
              disabled={isBusy}
              className="w-16 bg-transparent text-right text-[color:var(--text-primary)] outline-none"
            />
            <span>{t("labels.chars")}</span>
          </label>
          <span
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1",
              hasWorker
                ? "bg-[color:var(--glass-bg)]"
                : "bg-[color:var(--glass-recessed-bg)]"
            )}
          >
            {t("labels.model", {
              status: hasWorker ? t("labels.loaded") : t("labels.modelIdle"),
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
        {phase === "loading" ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--glass-recessed-bg)]">
            <div
              className="h-full rounded-full bg-[color:var(--accent-green)] transition-all"
              style={{ width: `${modelProgress ?? 18}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ToolPanel
          title={t("labels.input")}
          actions={<span>{t("labels.charCount", { count: charCount })}</span>}
          headerClassName="flex items-center justify-between text-xs text-[color:var(--text-secondary)]"
          className="min-h-[280px]"
        >
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError(null);
              setResults([]);
              setAnalysisStats(null);
              if (!isBusy) setPhase("idle");
            }}
            placeholder={t("placeholders.input")}
            spellCheck={false}
            disabled={isBusy}
            className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-green)]"
          />
          {isChunked ? (
            <p className="mt-2 text-[10px] text-amber-500/90">
              {t("hints.chunked", {
                size: effectiveChunkSize,
                max: MAX_CHUNK_CHARS,
              })}
            </p>
          ) : null}
        </ToolPanel>
        <ToolPanel
          title={t("labels.result")}
          actions={analysisStats ? <span>{analysisStats.duration} ms</span> : null}
          headerClassName="flex items-center justify-between text-xs text-[color:var(--text-secondary)]"
          className="min-h-[280px]"
        >
          <div className="mt-3 flex flex-1 flex-col gap-3 rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3">
            {topResult ? (
              <>
                <div className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-3">
                  <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
                    <span className="uppercase tracking-wide">
                      {t("labels.topLabel")}
                    </span>
                    <span className="font-semibold text-[color:var(--text-primary)]">
                      {formatPercent(topResult.score)}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                    {formatLabel(
                      topResult.label,
                      t("labels.unknown"),
                      t("labels.labelPrefix")
                    )}
                  </p>
                  <div className="mt-3 h-2 w-full rounded-full bg-[color:var(--glass-recessed-bg)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--accent-green)]"
                      style={{ width: formatPercent(topResult.score) }}
                    />
                  </div>
                  {analysisStats ? (
                    <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
                      {t("labels.analyzed", { count: analysisStats.chars })}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  {sortedResults.map((result) => (
                    <div
                      key={result.label}
                      className="flex items-center gap-3 rounded-[10px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2"
                    >
                      <span className="w-20 truncate text-xs text-[color:var(--text-secondary)]">
                        {formatLabel(
                          result.label,
                          t("labels.unknown"),
                          t("labels.labelPrefix")
                        )}
                      </span>
                      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--glass-recessed-bg)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--accent-blue)]"
                          style={{ width: formatPercent(result.score) }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[color:var(--text-primary)]">
                        {formatPercent(result.score)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[color:var(--text-secondary)]">
                {t("status.noResult")}
              </p>
            )}
          </div>
        </ToolPanel>
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
            className="mt-2 block text-[color:var(--text-primary)] transition-colors hover:text-[color:var(--accent-green)]"
          >
            {MODEL_ID}
          </a>
          <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
            {t("labels.modelNote")}
          </p>
        </div>
        <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
            {t("labels.usageNotes")}
          </p>
          <p className="mt-2">
            {t("labels.usageNote1")}
          </p>
          <p className="mt-2">{t("labels.usageNote2")}</p>
          <p className="mt-2">
            {t("labels.usageNote3")}
          </p>
        </div>
      </div>
    </div>
  );
}
