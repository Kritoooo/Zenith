import "server-only";

import { locales, type Locale } from "@/i18n/config";

const normalizeLocale = (value: string) => value.trim().toLowerCase();

const resolveBuildLocales = (): Locale[] => {
  const raw = process.env.BUILD_LOCALES;
  if (!raw) return [...locales];
  const candidates = raw
    .split(",")
    .map((item) => normalizeLocale(item))
    .filter(Boolean);
  if (candidates.length === 0) return [...locales];
  const unique = Array.from(new Set(candidates));
  const invalid = unique.filter(
    (locale) => !locales.includes(locale as Locale)
  );
  if (invalid.length > 0) {
    throw new Error(
      `BUILD_LOCALES contains unsupported locales: ${invalid.join(", ")}`
    );
  }
  return unique as Locale[];
};

export const buildLocales = resolveBuildLocales();
