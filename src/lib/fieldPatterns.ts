export type FieldPattern = {
  name: string;
  pattern: string;
};

export const createFieldId = () => {
  const cryptoRef =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined)
      : undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  return `field-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const parseFieldPatterns = (text: string): FieldPattern[] => {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const separators = [",", ":", "\t"];
      const separatorIndex = separators
        .map((sep) => trimmed.indexOf(sep))
        .filter((value) => value >= 0)
        .sort((a, b) => a - b)[0];
      if (separatorIndex !== undefined) {
        const name = trimmed.slice(0, separatorIndex).trim();
        const pattern = trimmed.slice(separatorIndex + 1).trim();
        if (!pattern) return null;
        return { name, pattern };
      }
      return { name: "", pattern: trimmed };
    })
    .filter(Boolean) as FieldPattern[];
};

export const serializeFieldPatterns = (
  patterns: Array<Pick<FieldPattern, "name" | "pattern">>
) =>
  patterns
    .map((pattern, index) =>
      `${pattern.name || `field${index + 1}`},${pattern.pattern}`
    )
    .join("\n");
