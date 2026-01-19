import { DETECT_NODE_LIMIT, DETECT_PATH_LIMIT } from "./constants";
import { appendArrayPath, appendPropertyPath } from "./paths";
import type { DetectSummary, JsonValue } from "./types";
import { isObject } from "./values";

export const detectPaths = (value: JsonValue) => {
  const paths = new Set<string>();
  let nodeCount = 0;
  let truncated = false;
  let reason: DetectSummary["reason"] = null;

  const addPath = (path: string) => {
    if (truncated) return;
    const normalized = path || "$";
    if (paths.has(normalized)) return;
    if (paths.size >= DETECT_PATH_LIMIT) {
      truncated = true;
      reason = "paths";
      return;
    }
    paths.add(normalized);
  };

  const walk = (node: JsonValue, current: string) => {
    if (truncated) return;
    nodeCount += 1;
    if (nodeCount > DETECT_NODE_LIMIT) {
      truncated = true;
      reason = "nodes";
      return;
    }

    if (Array.isArray(node)) {
      const arrayPath = appendArrayPath(current);
      if (node.length === 0) {
        addPath(arrayPath);
        return;
      }
      let sawPrimitive = false;
      for (const item of node) {
        if (item === null || typeof item !== "object") {
          sawPrimitive = true;
          continue;
        }
        walk(item as JsonValue, arrayPath);
        if (truncated) return;
      }
      if (sawPrimitive) addPath(arrayPath);
      return;
    }

    if (isObject(node)) {
      const entries = Object.entries(node);
      if (entries.length === 0) {
        addPath(current);
        return;
      }
      for (const [key, child] of entries) {
        walk(child as JsonValue, appendPropertyPath(current, key));
        if (truncated) return;
      }
      return;
    }

    addPath(current);
  };

  walk(value, "");
  return { paths: Array.from(paths).sort(), truncated, reason };
};
