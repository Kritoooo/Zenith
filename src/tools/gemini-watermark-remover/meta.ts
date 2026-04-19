import type { ToolMeta } from "@/tools/types";

export const meta: ToolMeta = {
  id: "gemini-watermark-remover",
  slug: "gemini-watermark-remover",
  title: "Gemini Watermark Remover",
  description: "Remove Gemini visible watermarks with reverse alpha blending.",
  icon: "GWT",
  category: "media",
  size: "2x1",
  highlights: ["Visible watermark", "No AI repaint", "On-device"],
};
