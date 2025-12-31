"use client";

import { useMemo, useState } from "react";

import { Button, GhostButton, SecondaryButton } from "@/components/Button";
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
          <Button
            variant={mode === "encode" ? "primary" : "secondary"}
            onClick={() => run("encode", input)}
            className="font-semibold"
          >
            Encode
          </Button>
          <Button
            variant={mode === "decode" ? "primary" : "secondary"}
            onClick={() => run("decode", input)}
            className="font-semibold"
          >
            Decode
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={swap} disabled={!output}>
            Swap
          </SecondaryButton>
          <SecondaryButton onClick={copyOutput} disabled={!output}>
            Copy
          </SecondaryButton>
          <GhostButton onClick={clearAll}>Clear</GhostButton>
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
