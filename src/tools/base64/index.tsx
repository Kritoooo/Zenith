"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";

type Mode = "encode" | "decode";

const SAMPLE_TEXT = "Hello, Zenith!";

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeBase64 = (value: string) => {
  const cleaned = value.replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export default function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState(SAMPLE_TEXT);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const status = useMemo(() => {
    if (error) return error;
    if (copied) return "Copied to clipboard.";
    return mode === "encode" ? "Ready to encode." : "Ready to decode.";
  }, [copied, error, mode]);

  const run = (nextMode: Mode, value: string) => {
    try {
      const nextOutput =
        nextMode === "encode" ? encodeBase64(value) : decodeBase64(value);
      setMode(nextMode);
      setOutput(nextOutput);
      setError(null);
      setCopied(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid Base64 input.";
      setError(message);
      setCopied(false);
      setOutput("");
      setMode(nextMode);
    }
  };

  const swap = () => {
    if (!output) return;
    const nextMode: Mode = mode === "encode" ? "decode" : "encode";
    setInput(output);
    run(nextMode, output);
  };

  const clearAll = () => {
    setInput("");
    setOutput("");
    setError(null);
    setCopied(false);
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Clipboard unavailable. Copy manually.");
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => run("encode", input)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)] transition-colors",
              mode === "encode"
                ? "bg-[color:var(--accent-blue)] text-white"
                : "border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
            )}
          >
            Encode
          </button>
          <button
            type="button"
            onClick={() => run("decode", input)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              mode === "decode"
                ? "bg-[color:var(--accent-blue)] text-white shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)]"
                : "border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
            )}
          >
            Decode
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={swap}
            disabled={!output}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-2 text-sm shadow-[var(--glass-shadow)] transition-colors",
              output
                ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
            )}
          >
            Swap
          </button>
          <button
            type="button"
            onClick={copyOutput}
            disabled={!output}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-2 text-sm shadow-[var(--glass-shadow)] transition-colors",
              output
                ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
            )}
          >
            Copy
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-full px-3 py-2 text-sm text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
          >
            Clear
          </button>
        </div>
      </div>
      <p
        className={cn(
          "min-h-[1.25rem] text-xs",
          error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
        )}
        aria-live="polite"
      >
        {status}
      </p>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Input
          </p>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError(null);
              setCopied(false);
            }}
            placeholder="Paste text or Base64..."
            spellCheck={false}
            className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
        <div className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Output
          </p>
          <textarea
            value={output}
            readOnly
            spellCheck={false}
            placeholder="Converted output appears here."
            className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
      </div>
    </div>
  );
}
