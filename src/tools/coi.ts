import coiToolSlugs from "./coi-slugs.json";

export const COI_TOOL_SLUGS = coiToolSlugs as readonly string[];

export const COI_TOOL_PATHS = COI_TOOL_SLUGS.map((slug) => `/tool/${slug}`);
