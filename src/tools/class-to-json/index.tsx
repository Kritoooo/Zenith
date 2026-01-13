"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { GhostButton, PrimaryButton, SecondaryButton } from "@/components/Button";
import { cn } from "@/lib/cn";

type Language = "java" | "go" | "python";

type Field = {
  name: string;
  type: string;
};

type ParseResult = {
  fields: Field[];
  classMap: Record<string, Field[]>;
};

type PrimitiveKind = "string" | "number" | "boolean" | "date" | "datetime" | "any";

type TypeDescriptor =
  | { kind: "primitive"; name: PrimitiveKind }
  | { kind: "array"; element: TypeDescriptor }
  | { kind: "map"; key: TypeDescriptor; value: TypeDescriptor }
  | { kind: "object"; name: string }
  | { kind: "unknown" };

const SAMPLE_INPUTS: Record<Language, string> = {
  java: `public class Order {
  private String id;
  private String customerName;
  private int quantity;
  private double totalAmount;
  private boolean paid;
  private List<String> tags;
  private Address address;
}

class Address {
  private String city;
  private String street;
}`,
  go: `type Order struct {
  ID string \`json:"id"\`
  CustomerName string \`json:"customer_name"\`
  Quantity int \`json:"quantity"\`
  TotalAmount float64 \`json:"total_amount"\`
  Paid bool \`json:"paid"\`
  Tags []string \`json:"tags"\`
  Address Address \`json:"address"\`
}

type Address struct {
  City string \`json:"city"\`
  Street string \`json:"street"\`
}`,
  python: `from dataclasses import dataclass
from typing import List

@dataclass
class Order:
    id: str
    customer_name: str
    quantity: int
    total_amount: float
    paid: bool
    tags: List[str]
    address: "Address"

@dataclass
class Address:
    city: str
    street: str
`,
};

const JAVA_MODIFIERS = new Set([
  "public",
  "private",
  "protected",
  "static",
  "final",
  "transient",
  "volatile",
  "synchronized",
  "abstract",
]);

const STRING_TYPES = new Set([
  "string",
  "str",
  "char",
  "character",
  "varchar",
  "text",
  "uuid",
]);

const NUMBER_TYPES = new Set([
  "int",
  "integer",
  "long",
  "float",
  "double",
  "decimal",
  "number",
  "short",
  "byte",
  "bigdecimal",
  "biginteger",
  "int64",
  "int32",
  "int16",
  "int8",
  "uint",
  "uint64",
  "uint32",
  "uint16",
  "uint8",
  "float64",
  "float32",
]);

const BOOLEAN_TYPES = new Set(["boolean", "bool"]);

const DATE_TYPES = new Set(["date", "localdate"]);

const DATETIME_TYPES = new Set([
  "datetime",
  "localdatetime",
  "instant",
  "timestamp",
  "offsetdatetime",
  "zoneddatetime",
  "time",
  "time.time",
]);

const NAMES = ["Alex Chen", "Jordan Lee", "Taylor Park", "Morgan Rivera"];
const CITIES = ["Seattle", "Austin", "Chicago", "Boston"];
const COUNTRIES = ["USA", "Canada", "UK", "Germany"];
const STATUSES = ["active", "pending", "archived", "draft"];
const TYPES = ["primary", "secondary", "tertiary", "basic"];

const stripBlockComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\//g, "");

const stripLineComments = (value: string) => value.replace(/\/\/.*$/g, "");

const stripPythonLineComment = (value: string) => value.replace(/#.*$/g, "");

const stripGoLineComment = (value: string) => {
  let inBacktick = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "`") {
      inBacktick = !inBacktick;
    }
    if (!inBacktick && char === "/" && value[i + 1] === "/") {
      return value.slice(0, i);
    }
  }
  return value;
};

const splitTopLevel = (value: string, separator: string) => {
  const parts: string[] = [];
  let current = "";
  let angleDepth = 0;
  let squareDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "<") angleDepth += 1;
    if (char === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (char === "[") squareDepth += 1;
    if (char === "]") squareDepth = Math.max(0, squareDepth - 1);
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    if (
      char === separator &&
      angleDepth === 0 &&
      squareDepth === 0 &&
      parenDepth === 0
    ) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const normalizeTypeName = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const parseType = (rawType: string, knownTypes: Set<string>): TypeDescriptor => {
  let type = normalizeTypeName(rawType);
  if (!type) return { kind: "unknown" };

  const unionParts = splitTopLevel(type, "|");
  if (unionParts.length > 1) {
    const filtered = unionParts.filter((part) => {
      const trimmed = part.trim().toLowerCase();
      return trimmed !== "none" && trimmed !== "null" && trimmed !== "nil";
    });
    if (filtered.length === 1) return parseType(filtered[0], knownTypes);
  }

  const optionalMatch = type.match(/^(Optional|Maybe)\s*[<\[](.+)[>\]]$/i);
  if (optionalMatch) return parseType(optionalMatch[2], knownTypes);

  if (type.endsWith("...")) {
    return { kind: "array", element: parseType(type.slice(0, -3), knownTypes) };
  }

  if (type.startsWith("*")) {
    type = type.slice(1).trim();
  }

  if (type.endsWith("[]")) {
    return { kind: "array", element: parseType(type.slice(0, -2), knownTypes) };
  }

  if (type.startsWith("[]")) {
    return { kind: "array", element: parseType(type.slice(2), knownTypes) };
  }

  const fixedArrayMatch = type.match(/^\[\d*\](.+)$/);
  if (fixedArrayMatch) {
    return {
      kind: "array",
      element: parseType(fixedArrayMatch[1], knownTypes),
    };
  }

  const javaListMatch = type.match(
    /^(List|ArrayList|LinkedList|Set|HashSet|Collection|Iterable|Slice|Array|Vec)\s*<(.+)>$/i
  );
  if (javaListMatch) {
    return { kind: "array", element: parseType(javaListMatch[2], knownTypes) };
  }

  const pyListMatch = type.match(/^(list|List|set|Set|tuple|Tuple)\s*\[(.+)\]$/);
  if (pyListMatch) {
    const args = splitTopLevel(pyListMatch[2], ",");
    return { kind: "array", element: parseType(args[0], knownTypes) };
  }

  const mapMatch = type.match(
    /^(Map|HashMap|LinkedHashMap|TreeMap|Dictionary|ConcurrentHashMap)\s*<(.+)>$/i
  );
  if (mapMatch) {
    const args = splitTopLevel(mapMatch[2], ",");
    return {
      kind: "map",
      key: parseType(args[0] ?? "string", knownTypes),
      value: parseType(args[1] ?? "string", knownTypes),
    };
  }

  const goMapMatch = type.match(/^map\[(.+?)\](.+)$/i);
  if (goMapMatch) {
    return {
      kind: "map",
      key: parseType(goMapMatch[1], knownTypes),
      value: parseType(goMapMatch[2], knownTypes),
    };
  }

  const pyMapMatch = type.match(/^(dict|Dict|Mapping|Map)\s*\[(.+)\]$/);
  if (pyMapMatch) {
    const args = splitTopLevel(pyMapMatch[2], ",");
    return {
      kind: "map",
      key: parseType(args[0] ?? "string", knownTypes),
      value: parseType(args[1] ?? "string", knownTypes),
    };
  }

  const normalizedLower = type.toLowerCase().replace(/\s+/g, "");
  if (DATETIME_TYPES.has(normalizedLower)) {
    return { kind: "primitive", name: "datetime" };
  }
  if (DATE_TYPES.has(normalizedLower)) {
    return { kind: "primitive", name: "date" };
  }

  const simpleName = type.split(".").pop() ?? type;
  const lower = simpleName.toLowerCase();
  if (STRING_TYPES.has(lower)) return { kind: "primitive", name: "string" };
  if (NUMBER_TYPES.has(lower)) return { kind: "primitive", name: "number" };
  if (BOOLEAN_TYPES.has(lower)) return { kind: "primitive", name: "boolean" };
  if (DATE_TYPES.has(lower)) return { kind: "primitive", name: "date" };
  if (DATETIME_TYPES.has(lower)) return { kind: "primitive", name: "datetime" };

  if (knownTypes.has(simpleName)) return { kind: "object", name: simpleName };
  if (simpleName && simpleName[0] === simpleName[0].toUpperCase()) {
    return { kind: "object", name: simpleName };
  }

  return { kind: "unknown" };
};

const toSlug = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const pad2 = (value: number) => String(value).padStart(2, "0");

const mockPrimitiveValue = (
  kind: PrimitiveKind,
  fieldName: string,
  index: number
) => {
  const lower = fieldName.toLowerCase();
  if (kind === "string") {
    if (lower.includes("email")) return `user${index + 1}@example.com`;
    if (lower.includes("phone"))
      return `+1-202-555-${pad2(10 + index)}`;
    if (lower.includes("url") || lower.includes("link"))
      return `https://example.com/${toSlug(fieldName) || "resource"}`;
    if (lower.includes("city")) return CITIES[index % CITIES.length];
    if (lower.includes("country")) return COUNTRIES[index % COUNTRIES.length];
    if (lower.includes("address")) return `${100 + index} Market St`;
    if (lower.includes("name")) return NAMES[index % NAMES.length];
    if (lower.includes("status")) return STATUSES[index % STATUSES.length];
    if (lower.includes("type")) return TYPES[index % TYPES.length];
    if (lower.includes("uuid"))
      return `550e8400-e29b-41d4-a716-44665544${pad2(index + 1)}`;
    if (lower.includes("id")) return String(index + 1);
    return `sample-${toSlug(fieldName) || "text"}-${index + 1}`;
  }
  if (kind === "number") {
    if (lower.includes("price") || lower.includes("amount") || lower.includes("total"))
      return Number((19.95 * (index + 1)).toFixed(2));
    if (lower.includes("count") || lower.includes("qty") || lower.includes("quantity"))
      return index + 1;
    if (lower.includes("age")) return 20 + index;
    if (lower.includes("rate") || lower.includes("score"))
      return Number((4.2 + index * 0.3).toFixed(1));
    if (lower.includes("lat")) return Number((37.77 + index * 0.01).toFixed(4));
    if (lower.includes("lng") || lower.includes("lon"))
      return Number((-122.41 - index * 0.01).toFixed(4));
    return index + 1;
  }
  if (kind === "boolean") {
    return index % 2 === 0;
  }
  if (kind === "date") {
    return `2025-01-${pad2(10 + index)}`;
  }
  if (kind === "datetime") {
    return `2025-01-${pad2(10 + index)}T0${index % 10}:00:00Z`;
  }
  return null;
};

const templatePrimitiveValue = (kind: PrimitiveKind) => {
  if (kind === "string") return "";
  if (kind === "number") return 0;
  if (kind === "boolean") return false;
  if (kind === "date") return "2025-01-01";
  if (kind === "datetime") return "2025-01-01T00:00:00Z";
  return null;
};

const buildValue = (
  descriptor: TypeDescriptor,
  fieldName: string,
  mode: "template" | "mock",
  index: number,
  classMap: Record<string, Field[]>,
  visited: Set<string>
): unknown => {
  if (descriptor.kind === "primitive") {
    return mode === "template"
      ? templatePrimitiveValue(descriptor.name)
      : mockPrimitiveValue(descriptor.name, fieldName, index);
  }

  if (descriptor.kind === "array") {
    const size = mode === "template" ? 1 : 2;
    return Array.from({ length: size }, (_, childIndex) =>
      buildValue(
        descriptor.element,
        fieldName,
        mode,
        index + childIndex,
        classMap,
        visited
      )
    );
  }

  if (descriptor.kind === "map") {
    const keyName = mode === "template" ? "key" : `key${index + 1}`;
    return {
      [keyName]: buildValue(
        descriptor.value,
        fieldName,
        mode,
        index,
        classMap,
        visited
      ),
    };
  }

  if (descriptor.kind === "object") {
    if (descriptor.name && visited.has(descriptor.name)) return {};
    const nextVisited = new Set(visited);
    if (descriptor.name) nextVisited.add(descriptor.name);
    const fields = descriptor.name ? classMap[descriptor.name] : undefined;
    if (fields && fields.length) {
      return buildObject(fields, classMap, mode, index, nextVisited);
    }
    return {};
  }

  return null;
};

const buildObject = (
  fields: Field[],
  classMap: Record<string, Field[]>,
  mode: "template" | "mock",
  index: number,
  visited: Set<string>
) => {
  const knownTypes = new Set(Object.keys(classMap));
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    const descriptor = parseType(field.type, knownTypes);
    acc[field.name] = buildValue(
      descriptor,
      field.name,
      mode,
      index,
      classMap,
      visited
    );
    return acc;
  }, {});
};

const parseJavaFieldLine = (line: string, nameOverride?: string | null) => {
  if (!line.includes(";")) return null;
  if (line.includes("(")) return null;
  if (/(class|interface|enum|record)\s+/.test(line)) return null;

  const cleaned = line.replace(/@\w+(?:\([^)]*\))?/g, "").trim();
  if (!cleaned.includes(";")) return null;

  const beforeSemicolon = cleaned.split(";")[0];
  const beforeAssign = beforeSemicolon.split("=")[0].trim();
  if (!beforeAssign) return null;

  let parts = beforeAssign.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  parts = parts.filter((part) => !JAVA_MODIFIERS.has(part));
  if (parts.length < 2) return null;

  const name = nameOverride ?? parts[parts.length - 1];
  const type = parts.slice(0, -1).join(" ");
  return { name, type };
};

const parseJava = (source: string): ParseResult => {
  const cleaned = stripBlockComments(source);
  const lines = cleaned.split(/\r?\n/);
  const classes: Record<string, Field[]> = {};
  const globalFields: Field[] = [];
  const stack: { name: string; depth: number }[] = [];
  let depth = 0;
  let pendingClass: string | null = null;
  let pendingNameOverride: string | null = null;
  let rootName: string | null = null;

  lines.forEach((rawLine) => {
    const line = stripLineComments(rawLine).trim();
    if (!line) return;

    const jsonPropertyMatch =
      line.match(/@JsonProperty\("([^"]+)"\)/) ||
      line.match(/@SerializedName\("([^"]+)"\)/);
    if (jsonPropertyMatch) {
      pendingNameOverride = jsonPropertyMatch[1];
    }

    if (stack.length > 0 && depth === stack[stack.length - 1].depth) {
      const field = parseJavaFieldLine(line, pendingNameOverride);
      if (field) {
        classes[stack[stack.length - 1].name].push(field);
        pendingNameOverride = null;
      }
    } else if (stack.length === 0) {
      const field = parseJavaFieldLine(line, pendingNameOverride);
      if (field) {
        globalFields.push(field);
        pendingNameOverride = null;
      }
    }

    const classMatch = line.match(/\b(class|record|interface|enum)\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      pendingClass = classMatch[2];
    }

    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;

    if (pendingClass && openCount > 0) {
      const classDepth = depth + openCount;
      stack.push({ name: pendingClass, depth: classDepth });
      if (!rootName) rootName = pendingClass;
      if (!classes[pendingClass]) classes[pendingClass] = [];
      pendingClass = null;
    }

    depth = depth + openCount - closeCount;
    while (stack.length > 0 && depth < stack[stack.length - 1].depth) {
      stack.pop();
    }
  });

  let fields: Field[] = [];
  if (rootName && classes[rootName]?.length) {
    fields = classes[rootName];
  } else {
    const firstClass = Object.keys(classes).find((name) => classes[name].length);
    if (firstClass) fields = classes[firstClass];
  }
  if (!fields.length) fields = globalFields;

  return { fields, classMap: classes };
};

const defaultJsonNameFromGo = (name: string) => {
  if (name.toUpperCase() === name) return name.toLowerCase();
  return name.charAt(0).toLowerCase() + name.slice(1);
};

const parseGoFieldLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("type ")) return null;
  if (trimmed.startsWith("//")) return null;

  const match = trimmed.match(
    /^([A-Za-z_][\w]*)\s+([^`]+?)(?:\s+`([^`]*)`)?$/
  );
  if (!match) return null;
  const name = match[1];
  const type = match[2].trim();
  const tag = match[3] ?? "";
  const jsonTagMatch = tag.match(/json:"([^"]*)"/);
  if (jsonTagMatch) {
    const tagValue = jsonTagMatch[1].split(",")[0];
    if (tagValue === "-") return null;
    if (tagValue) return { name: tagValue, type };
  }
  return { name: defaultJsonNameFromGo(name), type };
};

const parseGo = (source: string): ParseResult => {
  const cleaned = stripBlockComments(source);
  const lines = cleaned.split(/\r?\n/);
  const structs: Record<string, Field[]> = {};
  const stack: { name: string; depth: number }[] = [];
  let depth = 0;
  let pendingStruct: string | null = null;
  let rootName: string | null = null;

  lines.forEach((rawLine) => {
    const line = stripGoLineComment(rawLine);
    if (!line.trim()) return;

    if (stack.length > 0 && depth === stack[stack.length - 1].depth) {
      const field = parseGoFieldLine(line);
      if (field) structs[stack[stack.length - 1].name].push(field);
    }

    const structMatch = line.match(/\btype\s+([A-Za-z_]\w*)\s+struct\b/);
    if (structMatch) {
      pendingStruct = structMatch[1];
    }

    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;

    if (pendingStruct && openCount > 0) {
      const structDepth = depth + openCount;
      stack.push({ name: pendingStruct, depth: structDepth });
      if (!rootName) rootName = pendingStruct;
      if (!structs[pendingStruct]) structs[pendingStruct] = [];
      pendingStruct = null;
    }

    depth = depth + openCount - closeCount;
    while (stack.length > 0 && depth < stack[stack.length - 1].depth) {
      stack.pop();
    }
  });

  let fields: Field[] = [];
  if (rootName && structs[rootName]?.length) {
    fields = structs[rootName];
  } else {
    const firstStruct = Object.keys(structs).find((name) => structs[name].length);
    if (firstStruct) fields = structs[firstStruct];
  }

  return { fields, classMap: structs };
};

const parsePythonFieldLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("def ") || trimmed.startsWith("@")) return null;
  const match = trimmed.match(/^([A-Za-z_][\w]*)\s*:\s*([^=]+?)(?:\s*=\s*.+)?$/);
  if (!match) return null;
  return { name: match[1], type: match[2].trim() };
};

const parsePython = (source: string): ParseResult => {
  const lines = source.split(/\r?\n/);
  const classes: Record<string, Field[]> = {};
  let currentClass: { name: string; indent: number } | null = null;
  let rootName: string | null = null;

  const getIndent = (value: string) => value.match(/^\s*/)?.[0].length ?? 0;

  lines.forEach((rawLine) => {
    const line = stripPythonLineComment(rawLine);
    if (!line.trim()) return;

    const classMatch = line.match(/^\s*class\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      currentClass = { name: classMatch[1], indent: getIndent(line) };
      if (!rootName) rootName = classMatch[1];
      if (!classes[classMatch[1]]) classes[classMatch[1]] = [];
      return;
    }

    if (currentClass) {
      const indent = getIndent(line);
      if (indent <= currentClass.indent) {
        currentClass = null;
        return;
      }
      const field = parsePythonFieldLine(line);
      if (field) classes[currentClass.name].push(field);
    }
  });

  let fields: Field[] = [];
  if (rootName && classes[rootName]?.length) {
    fields = classes[rootName];
  } else {
    const firstClass = Object.keys(classes).find((name) => classes[name].length);
    if (firstClass) fields = classes[firstClass];
  }

  return { fields, classMap: classes };
};

const parseDefinition = (source: string, language: Language): ParseResult => {
  if (language === "java") return parseJava(source);
  if (language === "go") return parseGo(source);
  return parsePython(source);
};

export default function ClassToJsonTool() {
  const t = useTranslations("tools.class-to-json.ui");
  const [language, setLanguage] = useState<Language>("java");
  const [input, setInput] = useState(SAMPLE_INPUTS.java);
  const [templateOutput, setTemplateOutput] = useState("");
  const [mockOutput, setMockOutput] = useState("");
  const [mockCount, setMockCount] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"template" | "mock" | null>(null);

  const status = useMemo(() => {
    if (error) return error;
    if (copied === "template") return t("status.templateCopied");
    if (copied === "mock") return t("status.mockCopied");
    return t("status.ready");
  }, [copied, error, t]);

  const generate = () => {
    const { fields, classMap } = parseDefinition(input, language);
    if (!fields.length) {
      setError(t("errors.noFields"));
      setTemplateOutput("");
      setMockOutput("");
      setCopied(null);
      return;
    }

    const templateObject = buildObject(
      fields,
      classMap,
      "template",
      0,
      new Set()
    );
    const mockObjects = Array.from({ length: mockCount }, (_, index) =>
      buildObject(fields, classMap, "mock", index, new Set())
    );

    setTemplateOutput(JSON.stringify(templateObject, null, 2));
    setMockOutput(JSON.stringify(mockObjects, null, 2));
    setError(null);
    setCopied(null);
  };

  const loadSample = () => {
    setInput(SAMPLE_INPUTS[language]);
    setError(null);
    setCopied(null);
  };

  const clearAll = () => {
    setInput("");
    setTemplateOutput("");
    setMockOutput("");
    setError(null);
    setCopied(null);
  };

  const copyOutput = async (mode: "template" | "mock") => {
    const value = mode === "template" ? templateOutput : mockOutput;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      setError(t("errors.clipboard"));
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={generate}>{t("actions.generate")}</PrimaryButton>
          <SecondaryButton onClick={loadSample}>{t("actions.sample")}</SecondaryButton>
          <GhostButton onClick={clearAll}>{t("actions.clear")}</GhostButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 text-[11px] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)]">
            {(["java", "go", "python"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLanguage(value)}
                className={cn(
                  "rounded-full px-3 py-1 capitalize transition-colors",
                  value === language
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                {t(`languages.${value}`)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2 text-sm shadow-[var(--glass-shadow)]">
            <span className="text-xs text-[color:var(--text-secondary)]">
              {t("labels.mockRows")}
            </span>
            <input
              type="number"
              min={1}
              max={10}
              value={mockCount}
              onChange={(event) => {
                const value = Math.max(1, Math.min(10, Number(event.target.value)));
                setMockCount(Number.isNaN(value) ? 1 : value);
                setCopied(null);
              }}
              className="w-12 bg-transparent text-sm text-[color:var(--text-primary)] outline-none"
            />
          </div>
        </div>
      </div>
      <p
        className={cn(
          "min-h-[1.25rem] text-xs",
          error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
        )}
        aria-live="polite"
      >
        {status}
      </p>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[clamp(360px,58vh,720px)] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            {t("labels.input")}
          </p>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (error) setError(null);
              if (copied) setCopied(null);
            }}
            spellCheck={false}
            placeholder={t("placeholders.input")}
            className="mt-3 min-h-[clamp(260px,44vh,560px)] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 font-mono text-xs leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
        <div className="flex min-h-[clamp(360px,58vh,720px)] flex-1 flex-col gap-4">
          <div className="flex flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              <p>{t("labels.template")}</p>
              <SecondaryButton
                size="sm"
                onClick={() => copyOutput("template")}
                disabled={!templateOutput}
              >
                {t("actions.copy")}
              </SecondaryButton>
            </div>
            <textarea
              value={templateOutput}
              readOnly
              spellCheck={false}
              placeholder={t("placeholders.template")}
              className="mt-3 min-h-[200px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 font-mono text-xs leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
          </div>
          <div className="flex flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              <p>{t("labels.mockData")}</p>
              <SecondaryButton
                size="sm"
                onClick={() => copyOutput("mock")}
                disabled={!mockOutput}
              >
                {t("actions.copy")}
              </SecondaryButton>
            </div>
            <textarea
              value={mockOutput}
              readOnly
              spellCheck={false}
              placeholder={t("placeholders.mock")}
              className="mt-3 min-h-[200px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 font-mono text-xs leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
