import type { ToolMeta } from "@/tools/types";

import { meta as base64Meta } from "@/tools/base64/meta";
import { meta as animeUpscaleMeta } from "@/tools/anime-upscale/meta";
import { meta as codeCompareMeta } from "@/tools/code-compare/meta";
import { meta as colorConverterMeta } from "@/tools/color-converter/meta";
import { meta as imageCompressMeta } from "@/tools/image-compress/meta";
import { meta as jsonFormatterMeta } from "@/tools/json-formatter/meta";
import { meta as classToJsonMeta } from "@/tools/class-to-json/meta";
import { meta as localTimeMeta } from "@/tools/local-time/meta";
import { meta as downGitMeta } from "@/tools/downgit/meta";
import { meta as ytDlpMeta } from "@/tools/yt-dlp/meta";
import { meta as uuidMeta } from "@/tools/uuid/meta";
import { meta as aigcDetectorMeta } from "@/tools/aigc-detector/meta";
import { meta as addressGeneratorMeta } from "@/tools/address-generator/meta";
import { meta as paddleOcrMeta } from "@/tools/paddleocr-onnx/meta";

export const toolMetas: ToolMeta[] = [
  jsonFormatterMeta,
  classToJsonMeta,
  codeCompareMeta,
  downGitMeta,
  ytDlpMeta,
  colorConverterMeta,
  animeUpscaleMeta,
  paddleOcrMeta,
  imageCompressMeta,
  base64Meta,
  aigcDetectorMeta,
  uuidMeta,
  localTimeMeta,
  addressGeneratorMeta,
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
