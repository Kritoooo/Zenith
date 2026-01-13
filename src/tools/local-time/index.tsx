"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

type ClockZone = {
  key: "utc" | "newYork" | "tokyo";
  timeZone: string;
};

const WORLD_CLOCKS: ClockZone[] = [
  { key: "utc", timeZone: "UTC" },
  { key: "newYork", timeZone: "America/New_York" },
  { key: "tokyo", timeZone: "Asia/Tokyo" },
];

export default function LocalTimeTool() {
  const t = useTranslations("tools.local-time.ui");
  const locale = useLocale();
  const [now, setNow] = useState(() => new Date());
  const [is24h, setIs24h] = useState(true);
  const [showSeconds, setShowSeconds] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: showSeconds ? "2-digit" : undefined,
        hour12: !is24h,
      }),
    [is24h, locale, showSeconds]
  );

  const zoneFormatters = useMemo(() => {
    const baseOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: showSeconds ? "2-digit" : undefined,
      hour12: !is24h,
    } as const;
    return WORLD_CLOCKS.reduce(
      (acc, zone) => {
        acc[zone.timeZone] = new Intl.DateTimeFormat(locale, {
          ...baseOptions,
          timeZone: zone.timeZone,
        });
        return acc;
      },
      {} as Record<string, Intl.DateTimeFormat>
    );
  }, [is24h, locale, showSeconds]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale]
  );

  const localTime = timeFormatter.format(now);
  const localDate = dateFormatter.format(now);
  const isoString = now.toISOString();

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setCopied(t("errors.clipboard"));
    }
  };

  const formatZoneTime = (zone: ClockZone) =>
    (zoneFormatters[zone.timeZone] ??
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: showSeconds ? "2-digit" : undefined,
        hour12: !is24h,
        timeZone: zone.timeZone,
      })
    ).format(now);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIs24h((prev) => !prev)}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-xs transition-colors",
              is24h
                ? "bg-[color:var(--accent-blue)] text-white"
                : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
            )}
          >
            {t("actions.hour24")}
          </button>
          <button
            type="button"
            onClick={() => setShowSeconds((prev) => !prev)}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-xs transition-colors",
              showSeconds
                ? "bg-[color:var(--accent-blue)] text-white"
                : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
            )}
          >
            {t("actions.seconds")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => copyValue(t("labels.time"), localTime)}
            className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-xs text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
          >
            {t("actions.copyTime")}
          </button>
          <button
            type="button"
            onClick={() => copyValue(t("labels.iso"), isoString)}
            className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-xs text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
          >
            {t("actions.copyIso")}
          </button>
        </div>
      </div>
      <p className="text-xs text-[color:var(--text-secondary)]" aria-live="polite">
        {copied ? t("status.copied", { label: copied }) : t("status.ready")}
      </p>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-[20px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-6 shadow-[var(--glass-shadow)]">
          <div className="absolute -right-20 -top-24 h-48 w-48 rounded-full bg-[radial-gradient(circle,#007AFF33,transparent_70%)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--text-secondary)]">
            {t("labels.localTime")}
          </p>
          <div className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {localTime}
          </div>
          <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
            {localDate}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[20px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              {t("labels.timeZone")}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-primary)]">
              {timeZone}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              {t("labels.isoTimestamp")}
            </p>
            <p className="mt-2 break-all text-xs text-[color:var(--text-secondary)]">
              {isoString}
            </p>
          </div>
          <div className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
            {t("labels.widgetNote")}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {WORLD_CLOCKS.map((zone) => (
          <div
            key={zone.timeZone}
            className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4 text-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              {t(`zones.${zone.key}`)}
            </p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">
              {formatZoneTime(zone)}
            </p>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
              {zone.timeZone}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
