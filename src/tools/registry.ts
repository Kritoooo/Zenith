import type { ToolRegistration } from "@/tools/types";

import Base64Tool from "@/tools/base64";
import { meta as base64Meta } from "@/tools/base64/meta";
import CodeCompareTool from "@/tools/code-compare";
import { meta as codeCompareMeta } from "@/tools/code-compare/meta";
import ColorConverterTool from "@/tools/color-converter";
import { meta as colorConverterMeta } from "@/tools/color-converter/meta";
import ImageCompressTool from "@/tools/image-compress";
import { meta as imageCompressMeta } from "@/tools/image-compress/meta";
import JsonFormatterTool from "@/tools/json-formatter";
import { meta as jsonFormatterMeta } from "@/tools/json-formatter/meta";
import DownGitTool from "@/tools/downgit";
import { meta as downGitMeta } from "@/tools/downgit/meta";
import YtDlpTool from "@/tools/yt-dlp";
import { meta as ytDlpMeta } from "@/tools/yt-dlp/meta";
import LocalTimeTool from "@/tools/local-time";
import { meta as localTimeMeta } from "@/tools/local-time/meta";
import UuidTool from "@/tools/uuid";
import { meta as uuidMeta } from "@/tools/uuid/meta";

export const tools: ToolRegistration[] = [
  { meta: jsonFormatterMeta, component: JsonFormatterTool },
  { meta: codeCompareMeta, component: CodeCompareTool },
  { meta: downGitMeta, component: DownGitTool },
  { meta: ytDlpMeta, component: YtDlpTool },
  { meta: colorConverterMeta, component: ColorConverterTool },
  { meta: imageCompressMeta, component: ImageCompressTool },
  { meta: base64Meta, component: Base64Tool },
  { meta: uuidMeta, component: UuidTool },
  { meta: localTimeMeta, component: LocalTimeTool },
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
