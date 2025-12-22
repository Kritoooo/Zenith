"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

const SAMPLE_JSON = `{
  "project": "Zenith",
  "status": "ok",
  "items": [
    1,
    2,
    3
  ]
}`;

const indentOptions = [2, 4] as const;

export default function JsonFormatterTool() {
  const [input, setInput] = useState(SAMPLE_JSON);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [indent, setIndent] = useState<(typeof indentOptions)[number]>(2);
  const [copied, setCopied] = useState(false);

  const parseJson = () => {
    try {
      const value = JSON.parse(input);
      setError(null);
      return value;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid JSON payload.";
      setError(message);
      setOutput("");
      return undefined;
    }
  };

  const formatJson = () => {
    const value = parseJson();
    if (value === undefined) return;
    setCopied(false);
    setOutput(JSON.stringify(value, null, indent));
  };

  const minifyJson = () => {
    const value = parseJson();
    if (value === undefined) return;
    setCopied(false);
    setOutput(JSON.stringify(value));
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Clipboard unavailable. Select and copy manually.");
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={formatJson}
            className="rounded-full bg-[color:var(--accent-blue)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)]"
          >
            Format
          </button>
          <button
            type="button"
            onClick={minifyJson}
            className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-4 py-2 text-sm text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
          >
            Minify
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 text-[11px] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)]">
            {indentOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setIndent(value)}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  value === indent
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                {value} spaces
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copyOutput}
            disabled={!output}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-4 py-2 text-sm shadow-[var(--glass-shadow)] transition-colors",
              output
                ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
            )}
          >
            Copy
          </button>
        </div>
      </div>
      <p
        className={cn(
          "min-h-[1.25rem] text-xs",
          error
            ? "text-rose-500/80"
            : "text-[color:var(--text-secondary)]"
        )}
        aria-live="polite"
      >
        {error ?? (copied ? "Copied to clipboard." : "")}
      </p>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[320px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Input
          </p>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (error) setError(null);
              if (copied) setCopied(false);
            }}
            spellCheck={false}
            placeholder='{"hello":"world"}'
            className="mt-3 min-h-[240px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
        <div className="flex min-h-[320px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Output
          </p>
          <textarea
            value={output}
            readOnly
            spellCheck={false}
            placeholder="Formatted JSON appears here."
            className="mt-3 min-h-[240px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
      </div>
    </div>
  );
}
