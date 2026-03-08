type TranslationValues = Record<string, string | number | Date>;

export type Translator = (key: string, values?: TranslationValues) => string;
export type TranslatorWithRaw = Translator & {
  raw?: (key: string) => unknown;
};

export const resolveTranslationFallback = (
  translator: Translator,
  key: string,
  fallback: string,
  fullKey?: string
) => {
  const value = translator(key);
  return value === (fullKey ?? key) ? fallback : value;
};

export const resolveRawTranslationFallback = (
  translator: TranslatorWithRaw,
  key: string,
  fallback: string,
  fullKey?: string
) => {
  if (typeof translator.raw === "function") {
    const raw = translator.raw(key);
    if (typeof raw === "string") {
      return raw;
    }
  }
  return resolveTranslationFallback(translator, key, fallback, fullKey);
};
