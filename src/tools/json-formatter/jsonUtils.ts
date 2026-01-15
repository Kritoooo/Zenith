export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SummaryLabels = {
  array: string;
  object: string;
};

export const isJsonBranch = (
  value: JsonValue
): value is Record<string, JsonValue> | JsonValue[] =>
  typeof value === "object" && value !== null;

export const formatPrimitive = (value: JsonValue) => {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
};

export const formatKey = (value: string) => JSON.stringify(value);

export const getPrimitiveTone = (value: JsonValue) => {
  if (value === null) return "text-[color:var(--accent-pink)]";
  if (typeof value === "string") return "text-[color:var(--accent-green)]";
  if (typeof value === "number") return "text-[color:var(--accent-orange)]";
  return "text-[color:var(--accent-blue)]";
};

export const getNodeSummary = (value: JsonValue, labels: SummaryLabels) => {
  if (Array.isArray(value)) return `${labels.array}(${value.length})`;
  if (isJsonBranch(value)) return `${labels.object}(${Object.keys(value).length})`;
  return formatPrimitive(value);
};

export const buildPath = (parent: string, key: string | number) => {
  if (typeof key === "number") return `${parent}/${key}`;
  const escaped = key.replace(/~/g, "~0").replace(/\//g, "~1");
  return `${parent}/${escaped}`;
};

export const countNodesWithCap = (value: JsonValue, cap: number) => {
  let count = 0;
  const stack: JsonValue[] = [value];

  while (stack.length > 0 && count <= cap) {
    const current = stack.pop() as JsonValue;
    count += 1;
    if (count > cap) break;

    if (!isJsonBranch(current)) continue;

    const remaining = cap - count;
    if (remaining <= 0) {
      if (Array.isArray(current)) {
        if (current.length > 0) {
          count = cap + 1;
        }
      } else {
        for (const key in current) {
          if (Object.prototype.hasOwnProperty.call(current, key)) {
            count = cap + 1;
            break;
          }
        }
      }
      break;
    }

    if (Array.isArray(current)) {
      const limit = Math.min(current.length, remaining);
      for (let index = 0; index < limit; index += 1) {
        stack.push(current[index]);
      }
      if (current.length > remaining) {
        count = cap + 1;
        break;
      }
      continue;
    }

    let pushed = 0;
    let overflowed = false;
    for (const key in current) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
      if (pushed >= remaining) {
        overflowed = true;
        break;
      }
      stack.push((current as Record<string, JsonValue>)[key]);
      pushed += 1;
    }
    if (overflowed) {
      count = cap + 1;
      break;
    }
  }

  return count;
};

export const collectPaths = (
  value: JsonValue | null,
  path: string,
  paths: Set<string>,
  includeSelf: boolean
) => {
  if (!value || !isJsonBranch(value)) return;
  const stack: Array<{ node: JsonValue; path: string; includeSelf: boolean }> = [
    { node: value, path, includeSelf },
  ];

  while (stack.length > 0) {
    const current = stack.pop() as {
      node: JsonValue;
      path: string;
      includeSelf: boolean;
    };
    if (!isJsonBranch(current.node)) continue;
    if (current.includeSelf) paths.add(current.path);

    if (Array.isArray(current.node)) {
      for (let index = current.node.length - 1; index >= 0; index -= 1) {
        const child = current.node[index];
        if (!isJsonBranch(child)) continue;
        stack.push({
          node: child,
          path: buildPath(current.path, index),
          includeSelf: true,
        });
      }
      continue;
    }

    for (const key in current.node) {
      if (!Object.prototype.hasOwnProperty.call(current.node, key)) continue;
      const child = (current.node as Record<string, JsonValue>)[key];
      if (!isJsonBranch(child)) continue;
      stack.push({
        node: child,
        path: buildPath(current.path, key),
        includeSelf: true,
      });
    }
  }
};
