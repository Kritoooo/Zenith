import type { PathSegment } from "./types";

const isIdentifierKey = (value: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

const escapeQuotedKey = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

export const appendPropertyPath = (base: string, key: string) => {
  if (isIdentifierKey(key)) {
    return base ? `${base}.${key}` : key;
  }
  const token = `["${escapeQuotedKey(key)}"]`;
  return base ? `${base}${token}` : token;
};

export const appendArrayPath = (base: string) => (base ? `${base}[*]` : "[*]");

const parseQuotedKey = (token: string) => {
  if (token.startsWith("\"") && token.endsWith("\"")) {
    try {
      return JSON.parse(token) as string;
    } catch {
      return token.slice(1, -1);
    }
  }
  const raw = token.slice(1, -1);
  return raw.replace(/\\\\/g, "\\").replace(/\\'/g, "'");
};

export const parsePathSegments = (rawPath: string): PathSegment[] => {
  const trimmed = rawPath.trim();
  if (!trimmed) return [];
  let value = trimmed;
  if (value.startsWith("$")) {
    value = value.slice(1);
    if (value.startsWith(".")) value = value.slice(1);
  }

  const segments: PathSegment[] = [];
  let buffer = "";
  const pushBuffer = () => {
    if (buffer) {
      segments.push({ type: "property", key: buffer });
      buffer = "";
    }
  };

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === ".") {
      pushBuffer();
      continue;
    }
    if (char === "[") {
      pushBuffer();
      const closing = value.indexOf("]", i);
      if (closing === -1) {
        throw new Error("Missing closing bracket");
      }
      const token = value.slice(i + 1, closing).trim();
      if (!token || token === "*") {
        segments.push({ type: "wildcard" });
      } else if (/^\\d+$/.test(token)) {
        segments.push({ type: "index", index: Number(token) });
      } else if (
        (token.startsWith("\"") && token.endsWith("\"")) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        segments.push({ type: "property", key: parseQuotedKey(token) });
      } else {
        throw new Error("Invalid bracket token");
      }
      i = closing;
      continue;
    }
    buffer += char;
  }
  pushBuffer();
  return segments;
};

export const parsePathList = (value: string) =>
  value
    .split(/\\r?\\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("//"));
