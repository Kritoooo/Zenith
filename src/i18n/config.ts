export const locales = ["en", "zh"] as const;

export type Locale = (typeof locales)[number];

const normalizeLocale = (value: string) => value.trim().toLowerCase();
const isLocale = (value: string): value is Locale =>
  locales.includes(value as Locale);

const resolveDefaultLocale = (): Locale => {
  const fromEnv = normalizeLocale(process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "");
  if (fromEnv) {
    if (!isLocale(fromEnv)) {
      throw new Error(
        `NEXT_PUBLIC_DEFAULT_LOCALE must be one of: ${locales.join(", ")}`
      );
    }
    return fromEnv;
  }
  return "zh";
};

export const defaultLocale = resolveDefaultLocale();

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
};

export const toHtmlLang = (locale: string) => (locale === "zh" ? "zh-CN" : locale);
