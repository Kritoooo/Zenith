"use client";

import { useMemo, useRef, useState, useEffect } from "react";

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

const SAMPLE_TEXT = `这段中文用于演示 AI 文本检测工具。\n你可以粘贴长一些的中文段落，查看模型对其生成方式的判断。`;

const createDetectorWorker = () =>
  new Worker(new URL("./worker.ts", import.meta.url));

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatLabel = (label: string) => {
  const cleaned = label.trim();
  if (!cleaned) return "Unknown";
  if (/^LABEL_\d+$/i.test(cleaned)) {
    return `Label ${cleaned.split("_")[1]}`;
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
  const [input, setInput] = useState(SAMPLE_TEXT);
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
      return `${modelMessage ?? "Loading model"}${progressLabel}...`;
    }
    if (phase === "running") return "Analyzing text...";
    if (phase === "ready" && analysisStats) {
      return `Analysis complete in ${analysisStats.duration} ms.`;
    }
    return "Paste Chinese text and run detection.";
  }, [analysisStats, error, modelMessage, modelProgress, phase]);

  const runWorker = (text: string, chunkSize: number) => {
    const worker = workerRef.current ?? createDetectorWorker();
    if (!workerRef.current) workerRef.current = worker;
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
        modelId: MODEL_ID,
        text,
        chunkSize,
      });
    });
  };

  const analyze = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("请输入需要检测的文本。");
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
      setError(formatErrorMessage(err, "检测失败，请稍后重试。"));
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
    setInput(SAMPLE_TEXT);
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
            Analyze
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
            Sample
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
            <span>Chunk</span>
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
            <span>chars</span>
          </label>
          <span
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1",
              workerRef.current
                ? "bg-[color:var(--glass-bg)]"
                : "bg-[color:var(--glass-recessed-bg)]"
            )}
          >
            Model {workerRef.current ? "loaded" : "idle"}
          </span>
          <button
            type="button"
            onClick={unloadModel}
            disabled={!workerRef.current}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-2.5 py-1 transition-colors",
              workerRef.current
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
        <div className="flex min-h-[280px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wide">Input</span>
            <span>{charCount} chars</span>
          </div>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError(null);
              setResults([]);
              setAnalysisStats(null);
              if (!isBusy) setPhase("idle");
            }}
            placeholder="粘贴需要检测的中文文本..."
            spellCheck={false}
            disabled={isBusy}
            className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-green)]"
          />
          {isChunked ? (
            <p className="mt-2 text-[10px] text-amber-500/90">
              长文本会按 {effectiveChunkSize} 字符分段检测并汇总（单段最长 {MAX_CHUNK_CHARS}）。
            </p>
          ) : null}
        </div>
        <div className="flex min-h-[280px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
            <span className="font-semibold uppercase tracking-wide">Result</span>
            {analysisStats ? <span>{analysisStats.duration} ms</span> : null}
          </div>
          <div className="mt-3 flex flex-1 flex-col gap-3 rounded-[14px] bg-[color:var(--glass-recessed-bg)] p-3">
            {topResult ? (
              <>
                <div className="rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-3">
                  <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
                    <span className="uppercase tracking-wide">Top label</span>
                    <span className="font-semibold text-[color:var(--text-primary)]">
                      {formatPercent(topResult.score)}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
                    {formatLabel(topResult.label)}
                  </p>
                  <div className="mt-3 h-2 w-full rounded-full bg-[color:var(--glass-recessed-bg)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--accent-green)]"
                      style={{ width: formatPercent(topResult.score) }}
                    />
                  </div>
                  {analysisStats ? (
                    <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
                      Analyzed {analysisStats.chars} characters.
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
                        {formatLabel(result.label)}
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
                No analysis yet. Run detection to see model scores.
              </p>
            )}
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
            className="mt-2 block text-[color:var(--text-primary)] transition-colors hover:text-[color:var(--accent-green)]"
          >
            {MODEL_ID}
          </a>
          <p className="mt-2 text-[10px] text-[color:var(--text-secondary)]">
            The model is downloaded on first run and cached in the browser.
          </p>
        </div>
        <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
          <p className="font-semibold uppercase tracking-wide text-[10px] text-[color:var(--text-secondary)]">
            Usage notes
          </p>
          <p className="mt-2">
            Designed for Chinese text. Short or mixed-language inputs may be less reliable.
          </p>
          <p className="mt-2">检测时会自动移除空白字符（空格/换行）。</p>
          <p className="mt-2">
            Scores are probabilistic signals, not definitive authorship proof.
          </p>
        </div>
      </div>
    </div>
  );
}
