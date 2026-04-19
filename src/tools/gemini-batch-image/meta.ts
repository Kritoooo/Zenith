import type { ToolMeta } from "@/tools/types";

export const meta: ToolMeta = {
  id: "gemini-batch-image",
  slug: "gemini-batch-image",
  title: "Gemini Batch Image",
  description: "Run a prompt over a whole folder of images with the Gemini image model.",
  icon: "GB",
  category: "media",
  size: "2x2",
  highlights: ["Folder upload", "Batch generate", "ZIP export"],
};
