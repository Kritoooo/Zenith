import type { ToolMeta } from "@/tools/types";

import { meta as base64Meta } from "@/tools/base64/meta";
import { meta as colorConverterMeta } from "@/tools/color-converter/meta";
import { meta as imageCompressMeta } from "@/tools/image-compress/meta";
import { meta as jsonFormatterMeta } from "@/tools/json-formatter/meta";
import { meta as localTimeMeta } from "@/tools/local-time/meta";
import { meta as uuidMeta } from "@/tools/uuid/meta";

export const toolMetas: ToolMeta[] = [
  jsonFormatterMeta,
  colorConverterMeta,
  imageCompressMeta,
  base64Meta,
  uuidMeta,
  localTimeMeta,
];

export const toolMetaIndex = toolMetas.reduce(
  (acc, meta) => {
    acc[meta.slug] = meta;
    return acc;
  },
  {} as Record<string, ToolMeta>
);

export function getToolMetaBySlug(slug: string) {
  return toolMetaIndex[slug];
}
