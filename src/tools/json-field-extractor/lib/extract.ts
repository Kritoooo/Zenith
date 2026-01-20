import type { ExtractionItem, JsonValue, PathSegment } from "./types";
import { isObject } from "./values";

export const resolvePath = (value: JsonValue, segments: PathSegment[]): JsonValue[] => {
  let current: JsonValue[] = [value];
  for (const segment of segments) {
    const next: JsonValue[] = [];
    for (const entry of current) {
      if (segment.type === "property") {
        if (isObject(entry) && Object.prototype.hasOwnProperty.call(entry, segment.key)) {
          next.push(entry[segment.key]);
        }
        continue;
      }
      if (segment.type === "index") {
        if (Array.isArray(entry)) {
          const candidate = entry[segment.index];
          if (candidate !== undefined) next.push(candidate as JsonValue);
        }
        continue;
      }
      if (Array.isArray(entry)) {
        next.push(...(entry as JsonValue[]));
      } else if (isObject(entry)) {
        next.push(...(Object.values(entry) as JsonValue[]));
      }
    }
    current = next;
    if (current.length === 0) break;
  }
  return current;
};

export const toText = (value: JsonValue) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return JSON.stringify(value);
};

export const buildDefaultOutput = (items: ExtractionItem[]) =>
  items.flatMap((item) => item.values.map((value) => toText(value))).join("\n");

export const normalizeScriptResult = (result: unknown) => {
  if (result === null || result === undefined) return "";
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
};
