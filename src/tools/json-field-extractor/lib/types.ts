export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export type PathSegment =
  | { type: "property"; key: string }
  | { type: "index"; index: number }
  | { type: "wildcard" };

export type ExtractionItem = {
  path: string;
  values: JsonValue[];
};

export type RunSummary = {
  total: number;
  missing: number;
  usedScript: boolean;
};

export type DetectSummary = {
  count: number;
  truncated: boolean;
  reason: "paths" | "nodes" | null;
};

export type SavedScript = {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
};

export type ScriptNotice = {
  message: string;
  tone: "normal" | "error";
};
