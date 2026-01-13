"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, GhostButton, SecondaryButton } from "@/components/Button";
import { cn } from "@/lib/cn";

type Mode = "encode" | "decode";

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
  const t = useTranslations("tools.base64.ui");
  const sampleText = t("sample");
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState(sampleText);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const status = useMemo(() => {
    if (error) return error;
    if (copied) return t("status.copied");
    return mode === "encode" ? t("status.readyEncode") : t("status.readyDecode");
  }, [copied, error, mode, t]);

  const run = (nextMode: Mode, value: string) => {
    try {
      const nextOutput =
        nextMode === "encode" ? encodeBase64(value) : decodeBase64(value);
      setMode(nextMode);
      setOutput(nextOutput);
      setError(null);
      setCopied(false);
    } catch {
      setError(t("errors.invalid"));
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
      setError(t("errors.clipboard"));
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
            {t("actions.encode")}
          </Button>
          <Button
            variant={mode === "decode" ? "primary" : "secondary"}
            onClick={() => run("decode", input)}
            className="font-semibold"
          >
            {t("actions.decode")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={swap} disabled={!output}>
            {t("actions.swap")}
          </SecondaryButton>
          <SecondaryButton onClick={copyOutput} disabled={!output}>
            {t("actions.copy")}
          </SecondaryButton>
          <GhostButton onClick={clearAll}>{t("actions.clear")}</GhostButton>
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
            {t("labels.input")}
          </p>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError(null);
              setCopied(false);
            }}
            placeholder={t("placeholders.input")}
            spellCheck={false}
            className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
        <div className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            {t("labels.output")}
          </p>
          <textarea
            value={output}
            readOnly
            spellCheck={false}
            placeholder={t("placeholders.output")}
            className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
      </div>
    </div>
  );
}
