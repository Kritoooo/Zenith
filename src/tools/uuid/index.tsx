"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, PrimaryButton, SecondaryButton } from "@/components/Button";
import { ToolPanel } from "@/components/ToolPanel";
import { cn } from "@/lib/cn";
import { useClipboard } from "@/lib/useClipboard";

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
    throw new Error("RNG_UNAVAILABLE");
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
  const t = useTranslations("tools.uuid.ui");
  const [count, setCount] = useState(3);
  const [uppercase, setUppercase] = useState(false);
  const [withHyphens, setWithHyphens] = useState(true);
  const [uuids, setUuids] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy, reset } = useClipboard({
    onError: () => setError(t("errors.clipboard")),
  });

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
      reset();
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.message === "RNG_UNAVAILABLE") {
        setError(t("errors.rng"));
      } else {
        setError(t("errors.generate"));
      }
    }
  }, [formatUuid, normalizedCount, reset, t]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      generate();
    }, 0);
    return () => window.clearTimeout(id);
  }, [generate]);

  const copyAll = async () => {
    if (!uuids.length) return;
    await copy(uuids.join("\n"));
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2 text-sm shadow-[var(--glass-shadow)]">
            <span className="text-xs text-[color:var(--text-secondary)]">
              {t("labels.count")}
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(event) => {
                setCount(Number(event.target.value));
                reset();
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
            {t("actions.hyphens")}
          </Button>
          <Button
            variant={uppercase ? "primary" : "secondary"}
            size="sm"
            onClick={() => setUppercase((prev) => !prev)}
          >
            {t("actions.uppercase")}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={generate}>{t("actions.generate")}</PrimaryButton>
        <SecondaryButton onClick={copyAll} disabled={!uuids.length}>
          {t("actions.copy")}
        </SecondaryButton>
        <p
          className={cn(
            "text-xs",
            error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
          )}
          aria-live="polite"
        >
          {error ? error : copied ? t("status.copied") : t("status.ready")}
        </p>
      </div>
      <ToolPanel title={t("labels.output")} className="min-h-[260px]">
        <textarea
          value={uuids.join("\n")}
          readOnly
          spellCheck={false}
          className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
        />
      </ToolPanel>
    </div>
  );
}
