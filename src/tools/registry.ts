import dynamic from "next/dynamic";

import type { ToolRegistration } from "@/tools/types";

import { meta as animeUpscaleMeta } from "@/tools/anime-upscale/meta";
import { meta as base64Meta } from "@/tools/base64/meta";
import { meta as codeCompareMeta } from "@/tools/code-compare/meta";
import { meta as colorConverterMeta } from "@/tools/color-converter/meta";
import { meta as imageCompressMeta } from "@/tools/image-compress/meta";
import { meta as jsonFormatterMeta } from "@/tools/json-formatter/meta";
import { meta as jsonFieldExtractorMeta } from "@/tools/json-field-extractor/meta";
import { meta as classToJsonMeta } from "@/tools/class-to-json/meta";
import { meta as downGitMeta } from "@/tools/downgit/meta";
import { meta as ytDlpMeta } from "@/tools/yt-dlp/meta";
import { meta as localTimeMeta } from "@/tools/local-time/meta";
import { meta as uuidMeta } from "@/tools/uuid/meta";
import { meta as aigcDetectorMeta } from "@/tools/aigc-detector/meta";
import { meta as addressGeneratorMeta } from "@/tools/address-generator/meta";
import { meta as paddleOcrMeta } from "@/tools/paddleocr-onnx/meta";

// 动态导入工具组件，实现代码分割
// 每个工具会被打包成独立的 chunk，只在访问时加载
const JsonFormatterTool = dynamic(() => import("@/tools/json-formatter"));
const JsonFieldExtractorTool = dynamic(() => import("@/tools/json-field-extractor"));
const ClassToJsonTool = dynamic(() => import("@/tools/class-to-json"));
const CodeCompareTool = dynamic(() => import("@/tools/code-compare"));
const DownGitTool = dynamic(() => import("@/tools/downgit"));
const YtDlpTool = dynamic(() => import("@/tools/yt-dlp"));
const ColorConverterTool = dynamic(() => import("@/tools/color-converter"));
const AnimeUpscaleTool = dynamic(() => import("@/tools/anime-upscale"));
const PaddleOcrTool = dynamic(() => import("@/tools/paddleocr-onnx"));
const ImageCompressTool = dynamic(() => import("@/tools/image-compress"));
const Base64Tool = dynamic(() => import("@/tools/base64"));
const AigcDetectorTool = dynamic(() => import("@/tools/aigc-detector"));
const UuidTool = dynamic(() => import("@/tools/uuid"));
const LocalTimeTool = dynamic(() => import("@/tools/local-time"));
const AddressGeneratorTool = dynamic(() => import("@/tools/address-generator"));

export const tools: ToolRegistration[] = [
  { meta: jsonFormatterMeta, component: JsonFormatterTool },
  { meta: jsonFieldExtractorMeta, component: JsonFieldExtractorTool },
  { meta: classToJsonMeta, component: ClassToJsonTool },
  { meta: codeCompareMeta, component: CodeCompareTool },
  { meta: downGitMeta, component: DownGitTool },
  { meta: ytDlpMeta, component: YtDlpTool },
  { meta: colorConverterMeta, component: ColorConverterTool },
  { meta: animeUpscaleMeta, component: AnimeUpscaleTool },
  { meta: paddleOcrMeta, component: PaddleOcrTool },
  { meta: imageCompressMeta, component: ImageCompressTool },
  { meta: base64Meta, component: Base64Tool },
  { meta: aigcDetectorMeta, component: AigcDetectorTool },
  { meta: uuidMeta, component: UuidTool },
  { meta: localTimeMeta, component: LocalTimeTool },
  { meta: addressGeneratorMeta, component: AddressGeneratorTool },
];

export const toolIndex = tools.reduce(
  (acc, tool) => {
    acc[tool.meta.slug] = tool;
    return acc;
  },
  {} as Record<string, ToolRegistration>
);

export function getToolBySlug(slug: string) {
  return toolIndex[slug];
}
