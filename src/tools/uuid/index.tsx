"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, PrimaryButton, SecondaryButton } from "@/components/Button";
import { cn } from "@/lib/cn";

const QUICK_COUNTS = [1, 3, 5] as const;

const createUuid = () => {
  const cryptoRef =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined)
      : undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== "function") {
    throw new Error("Secure random generator is unavailable.");
  }
  const bytes = new Uint8Array(16);
  cryptoRef.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
};

export default function UuidTool() {
  const [count, setCount] = useState(3);
  const [uppercase, setUppercase] = useState(false);
  const [withHyphens, setWithHyphens] = useState(true);
  const [uuids, setUuids] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCount = useMemo(() => Math.min(Math.max(count, 1), 20), [count]);

  const formatUuid = useCallback(
    (value: string) => {
      let output = withHyphens ? value : value.replace(/-/g, "");
      if (uppercase) output = output.toUpperCase();
      return output;
    },
    [uppercase, withHyphens]
  );

  const generate = useCallback(() => {
    try {
      const next = Array.from({ length: normalizedCount }, () =>
        formatUuid(createUuid())
      );
      setUuids(next);
      setCopied(false);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to generate UUIDs.";
      setError(message);
    }
  }, [formatUuid, normalizedCount]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      generate();
    }, 0);
    return () => window.clearTimeout(id);
  }, [generate]);

  const copyAll = async () => {
    if (!uuids.length) return;
    try {
      await navigator.clipboard.writeText(uuids.join("\n"));
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
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2 text-sm shadow-[var(--glass-shadow)]">
            <span className="text-xs text-[color:var(--text-secondary)]">Count</span>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(event) => {
                setCount(Number(event.target.value));
                setCopied(false);
              }}
              className="w-14 bg-transparent text-sm text-[color:var(--text-primary)] outline-none"
            />
          </div>
          {QUICK_COUNTS.map((value) => (
            <SecondaryButton key={value} size="sm" onClick={() => setCount(value)}>
              {value}
            </SecondaryButton>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={withHyphens ? "primary" : "secondary"}
            size="sm"
            onClick={() => setWithHyphens((prev) => !prev)}
          >
            Hyphens
          </Button>
          <Button
            variant={uppercase ? "primary" : "secondary"}
            size="sm"
            onClick={() => setUppercase((prev) => !prev)}
          >
            Uppercase
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={generate}>Generate</PrimaryButton>
        <SecondaryButton onClick={copyAll} disabled={!uuids.length}>
          Copy
        </SecondaryButton>
        <p
          className={cn(
            "text-xs",
            error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
          )}
          aria-live="polite"
        >
          {error ? error : copied ? "Copied to clipboard." : "v4 UUIDs"}
        </p>
      </div>
      <div className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Output
        </p>
        <textarea
          value={uuids.join("\n")}
          readOnly
          spellCheck={false}
          className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
        />
      </div>
    </div>
  );
}
