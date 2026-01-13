export const locales = ["en", "zh"] as const;
export const defaultLocale = "zh";

export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  zh: "中文",
};

export const toHtmlLang = (locale: string) => (locale === "zh" ? "zh-CN" : locale);
