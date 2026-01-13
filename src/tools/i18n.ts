import type { ToolMeta } from "@/tools/types";

type TranslationValues = Record<string, string | number | Date>;

type Translator = {
  (key: string, values?: TranslationValues): string;
  raw?: (key: string) => unknown;
};

const getHighlights = (translator: Translator, key: string, fallback?: string[]) => {
  if (typeof translator.raw !== "function") return fallback;
  const raw = translator.raw(key);
  return Array.isArray(raw) ? (raw as string[]) : fallback;
};

export function localizeToolMeta(meta: ToolMeta, t: Translator): ToolMeta {
  const baseKey = `tools.${meta.slug}`;
  return {
    ...meta,
    title: t(`${baseKey}.title`),
    description: t(`${baseKey}.description`),
    badge: meta.badge ? t(`${baseKey}.badge`) : undefined,
    highlights: meta.highlights
      ? getHighlights(t, `${baseKey}.highlights`, meta.highlights)
      : undefined,
  };
}

export function localizeToolMetas(metas: ToolMeta[], t: Translator): ToolMeta[] {
  return metas.map((meta) => localizeToolMeta(meta, t));
}
