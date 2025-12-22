import type { ComponentType } from "react";

export type ToolCategory = "dev" | "design" | "media" | "utility";
export type ToolSize = "1x1" | "2x1" | "2x2";

export type ToolMeta = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: ToolCategory;
  size: ToolSize;
  badge?: string;
  highlights?: string[];
};

export type ToolRegistration = {
  meta: ToolMeta;
  component: ComponentType;
};
