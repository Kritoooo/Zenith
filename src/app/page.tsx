"use client";

import { useEffect } from "react";

import { defaultLocale, locales, type Locale } from "@/i18n/config";

const LOCALE_STORAGE_KEY = "zenith-locale";

const normalizeLocale = (value: string) => value.trim().toLowerCase();

const isLocale = (value: string): value is Locale =>
  locales.includes(value as Locale);

const resolveBrowserLocale = () => {
  if (typeof navigator === "undefined") return null;
  const list = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  for (const lang of list) {
    const normalized = normalizeLocale(lang);
    if (!normalized) continue;
    if (normalized.startsWith("zh")) return "zh";
    if (normalized.startsWith("en")) return "en";
    const base = normalized.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
};

export default function RootPage() {
  useEffect(() => {
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
    let preferred: Locale | null = null;
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && isLocale(normalizeLocale(stored))) {
        preferred = normalizeLocale(stored) as Locale;
      }
    } catch {
      // Ignore storage errors.
    }
    if (!preferred) {
      preferred = resolveBrowserLocale() ?? defaultLocale;
    }
    const target = `${basePath}/${preferred}`;
    window.location.replace(target);
  }, []);

  return null;
}
