import type { ToolMeta } from "@/tools/types";

export const meta: ToolMeta = {
  id: "paddleocr-onnx",
  slug: "paddleocr-onnx",
  title: "WebGPU OCR",
  description: "Extract text with PaddleOCR ONNX models running in the browser.",
  icon: "OCR",
  category: "media",
  size: "2x2",
  badge: "WebGPU",
  highlights: ["PaddleOCR", "On-device", "WebGPU"],
};
