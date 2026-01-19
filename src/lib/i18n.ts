type TranslationValues = Record<string, string | number | Date>;

export type Translator = (key: string, values?: TranslationValues) => string;

export const resolveTranslationFallback = (
  translator: Translator,
  key: string,
  fallback: string,
  fullKey?: string
) => {
  const value = translator(key);
  return value === (fullKey ?? key) ? fallback : value;
};
