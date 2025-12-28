import type { ToolMeta } from "@/tools/types";

export const meta: ToolMeta = {
  id: "aigc-detector",
  slug: "aigc-detector",
  title: "AIGC Detector",
  description: "Detect AI-generated Chinese text with on-device inference.",
  icon: "AIGC",
  category: "utility",
  size: "2x1",
  highlights: ["Chinese", "On-device", "ONNX"],
};
