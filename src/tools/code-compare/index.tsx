"use client";

import {
  useCallback,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";

type DiffOp = { type: "equal" | "delete" | "insert"; value: string };
type DiffRange = {
  start1: number;
  end1: number;
  start2: number;
  end2: number;
};

type Segment = {
  value: string;
  type: "equal" | "delete" | "insert";
};

type LineData = {
  number: number;
  text: string;
  segments?: Segment[];
};

type DiffRow = {
  kind: "equal" | "delete" | "insert" | "replace";
  left?: LineData;
  right?: LineData;
};

type InlineRow = {
  id: string;
  kind: "equal" | "delete" | "insert";
  leftNumber?: number;
  rightNumber?: number;
  text: string;
  segments?: Segment[];
};

type ViewMode = "split" | "inline";

const SAMPLE_LEFT = `function greet(name) {
  return "Hello " + name;
}

const value = greet("Zenith");
console.log(value);`;

const SAMPLE_RIGHT = `function greet(name: string) {
  return \`Hello, \${name}!\`;
}

const result = greet("Zenith");
console.log(result);`;

const TOKEN_REGEX = /[A-Za-z0-9_]+|\s+|[^\sA-Za-z0-9_]/g;

const splitChars = (value: string) => Array.from(value);
const splitTokens = (value: string) => value.match(TOKEN_REGEX) ?? [];
const parenDelta = (value: string) => {
  let balance = 0;
  for (const char of value) {
    if (char === "(") balance += 1;
    if (char === ")") balance -= 1;
  }
  return balance;
};

const shouldMergeParenInserts = (lines: LineData[]) => {
  if (lines.length <= 1) return false;
  const firstDelta = parenDelta(lines[0].text);
  if (firstDelta === 0) return false;
  const totalDelta = lines.reduce((sum, line) => sum + parenDelta(line.text), 0);
  return totalDelta === 0;
};

const splitSegmentsByNewline = (segments: Segment[], lineCount: number) => {
  const lines: Segment[][] = Array.from({ length: lineCount }, () => []);
  let lineIndex = 0;

  const pushSegment = (target: Segment[], type: Segment["type"], value: string) => {
    if (!value) return;
    const prev = target[target.length - 1];
    if (prev && prev.type === type) {
      prev.value += value;
    } else {
      target.push({ value, type });
    }
  };

  segments.forEach((segment) => {
    const parts = segment.value.split("\n");
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) {
        lineIndex = Math.min(lineIndex + 1, lineCount - 1);
      }
      if (!part) return;
      pushSegment(lines[lineIndex], segment.type, part);
    });
  });

  return lines;
};

const SMALL_DIFF_LIMIT = 1700;

class Array2D {
  private readonly array: Float64Array;

  constructor(public readonly width: number, public readonly height: number) {
    this.array = new Float64Array(width * height);
  }

  get(x: number, y: number) {
    return this.array[x + y * this.width];
  }

  set(x: number, y: number, value: number) {
    this.array[x + y * this.width] = value;
  }
}

class SnakePath {
  constructor(
    public readonly prev: SnakePath | null,
    public readonly x: number,
    public readonly y: number,
    public readonly length: number
  ) {}
}

const getEqualityScore = (value: string) => {
  if (value.length === 0) return 0.1;
  return 1 + Math.log(1 + value.length);
};

const dynamicProgrammingDiff = (
  left: string[],
  right: string[],
  equalityScore: (leftIndex: number, rightIndex: number) => number
): DiffRange[] => {
  const lcsLengths = new Array2D(left.length, right.length);
  const directions = new Array2D(left.length, right.length);
  const lengths = new Array2D(left.length, right.length);

  for (let s1 = 0; s1 < left.length; s1 += 1) {
    for (let s2 = 0; s2 < right.length; s2 += 1) {
      const horizontalLen = s1 === 0 ? 0 : lcsLengths.get(s1 - 1, s2);
      const verticalLen = s2 === 0 ? 0 : lcsLengths.get(s1, s2 - 1);

      let extendedScore = -1;
      if (left[s1] === right[s2]) {
        if (s1 === 0 || s2 === 0) {
          extendedScore = 0;
        } else {
          extendedScore = lcsLengths.get(s1 - 1, s2 - 1);
        }
        if (s1 > 0 && s2 > 0 && directions.get(s1 - 1, s2 - 1) === 3) {
          extendedScore += lengths.get(s1 - 1, s2 - 1);
        }
        extendedScore += equalityScore(s1, s2);
      }

      const newValue = Math.max(horizontalLen, verticalLen, extendedScore);

      if (newValue === extendedScore) {
        const prevLen = s1 > 0 && s2 > 0 ? lengths.get(s1 - 1, s2 - 1) : 0;
        lengths.set(s1, s2, prevLen + 1);
        directions.set(s1, s2, 3);
      } else if (newValue === horizontalLen) {
        lengths.set(s1, s2, 0);
        directions.set(s1, s2, 1);
      } else {
        lengths.set(s1, s2, 0);
        directions.set(s1, s2, 2);
      }

      lcsLengths.set(s1, s2, newValue);
    }
  }

  const diffs: DiffRange[] = [];
  let lastAligningPosS1 = left.length;
  let lastAligningPosS2 = right.length;

  const reportDecreasingAligningPositions = (s1: number, s2: number) => {
    if (s1 + 1 !== lastAligningPosS1 || s2 + 1 !== lastAligningPosS2) {
      diffs.push({
        start1: s1 + 1,
        end1: lastAligningPosS1,
        start2: s2 + 1,
        end2: lastAligningPosS2,
      });
    }
    lastAligningPosS1 = s1;
    lastAligningPosS2 = s2;
  };

  let s1 = left.length - 1;
  let s2 = right.length - 1;
  while (s1 >= 0 && s2 >= 0) {
    if (directions.get(s1, s2) === 3) {
      reportDecreasingAligningPositions(s1, s2);
      s1 -= 1;
      s2 -= 1;
    } else if (directions.get(s1, s2) === 1) {
      s1 -= 1;
    } else {
      s2 -= 1;
    }
  }

  reportDecreasingAligningPositions(-1, -1);
  diffs.reverse();
  return diffs;
};

const myersDiff = (left: string[], right: string[]): DiffRange[] => {
  const seqX = left;
  const seqY = right;

  const getXAfterSnake = (x: number, y: number) => {
    while (x < seqX.length && y < seqY.length && seqX[x] === seqY[y]) {
      x += 1;
      y += 1;
    }
    return x;
  };

  const max = seqX.length + seqY.length;
  const offset = max;
  const v = new Int32Array(2 * max + 1);
  const paths: Array<SnakePath | null> = new Array(2 * max + 1).fill(null);

  v[offset] = getXAfterSnake(0, 0);
  paths[offset] =
    v[offset] === 0 ? null : new SnakePath(null, 0, 0, v[offset]);

  if (v[offset] === seqX.length && seqX.length === seqY.length) {
    return [];
  }

  let endK = 0;

  loop: for (let d = 1; ; d += 1) {
    const lowerBound = -Math.min(d, seqY.length + (d % 2));
    const upperBound = Math.min(d, seqX.length + (d % 2));
    for (let k = lowerBound; k <= upperBound; k += 2) {
      const maxXofDLineTop = k === upperBound ? -1 : v[offset + k + 1];
      const maxXofDLineLeft =
        k === lowerBound ? -1 : v[offset + k - 1] + 1;
      const x = Math.min(
        Math.max(maxXofDLineTop, maxXofDLineLeft),
        seqX.length
      );
      const y = x - k;
      if (x > seqX.length || y > seqY.length) {
        continue;
      }

      const newMaxX = getXAfterSnake(x, y);
      v[offset + k] = newMaxX;
      const lastPath =
        x === maxXofDLineTop ? paths[offset + k + 1] : paths[offset + k - 1];
      paths[offset + k] =
        newMaxX !== x ? new SnakePath(lastPath, x, y, newMaxX - x) : lastPath;

      if (v[offset + k] === seqX.length && v[offset + k] - k === seqY.length) {
        endK = k;
        break loop;
      }
    }
  }

  let path = paths[offset + endK];
  const diffs: DiffRange[] = [];
  let lastAligningPosS1 = seqX.length;
  let lastAligningPosS2 = seqY.length;

  while (true) {
    const endX = path ? path.x + path.length : 0;
    const endY = path ? path.y + path.length : 0;

    if (endX !== lastAligningPosS1 || endY !== lastAligningPosS2) {
      diffs.push({
        start1: endX,
        end1: lastAligningPosS1,
        start2: endY,
        end2: lastAligningPosS2,
      });
    }

    if (!path) {
      break;
    }
    lastAligningPosS1 = path.x;
    lastAligningPosS2 = path.y;
    path = path.prev;
  }

  diffs.reverse();
  return diffs;
};

const buildDiffRanges = (left: string[], right: string[]): DiffRange[] => {
  if (left.length === 0 && right.length === 0) {
    return [];
  }

  if (left.length === 0 || right.length === 0) {
    return [
      {
        start1: 0,
        end1: left.length,
        start2: 0,
        end2: right.length,
      },
    ];
  }

  if (left.length + right.length < SMALL_DIFF_LIMIT) {
    return dynamicProgrammingDiff(left, right, (leftIndex) =>
      getEqualityScore(left[leftIndex] ?? "")
    );
  }

  return myersDiff(left, right);
};

const diffRangesToOps = (
  left: string[],
  right: string[],
  ranges: DiffRange[]
): DiffOp[] => {
  const ops: DiffOp[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  const pushEqual = (count: number) => {
    for (let i = 0; i < count; i += 1) {
      ops.push({ type: "equal", value: left[leftIndex + i] ?? "" });
    }
    leftIndex += count;
    rightIndex += count;
  };

  ranges.forEach((range) => {
    const equalCount = range.start1 - leftIndex;
    if (equalCount > 0) {
      pushEqual(equalCount);
    }

    for (let i = range.start1; i < range.end1; i += 1) {
      ops.push({ type: "delete", value: left[i] ?? "" });
    }
    for (let i = range.start2; i < range.end2; i += 1) {
      ops.push({ type: "insert", value: right[i] ?? "" });
    }

    leftIndex = range.end1;
    rightIndex = range.end2;
  });

  const trailingEqual = Math.min(left.length - leftIndex, right.length - rightIndex);
  if (trailingEqual > 0) {
    pushEqual(trailingEqual);
  }

  for (let i = leftIndex; i < left.length; i += 1) {
    ops.push({ type: "delete", value: left[i] ?? "" });
  }
  for (let i = rightIndex; i < right.length; i += 1) {
    ops.push({ type: "insert", value: right[i] ?? "" });
  }

  return ops;
};

const diffSequence = (left: string[], right: string[]): DiffOp[] => {
  const ranges = buildDiffRanges(left, right);
  return diffRangesToOps(left, right, ranges);
};

const diffTokens = (left: string, right: string, mode: "token" | "char") => {
  const ops =
    mode === "char"
      ? diffSequence(splitChars(left), splitChars(right))
      : diffSequence(splitTokens(left), splitTokens(right));
  const leftSegments: Segment[] = [];
  const rightSegments: Segment[] = [];

  const pushSegment = (segments: Segment[], type: Segment["type"], value: string) => {
    if (!value) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.type === type) {
      prev.value += value;
    } else {
      segments.push({ value, type });
    }
  };

  ops.forEach((op) => {
    if (op.type === "equal") {
      pushSegment(leftSegments, "equal", op.value);
      pushSegment(rightSegments, "equal", op.value);
      return;
    }
    if (op.type === "delete") {
      pushSegment(leftSegments, "delete", op.value);
      return;
    }
    pushSegment(rightSegments, "insert", op.value);
  });

  return { leftSegments, rightSegments };
};

const buildDiffRows = (
  leftText: string,
  rightText: string,
  highlightMode: "token" | "char"
): DiffRow[] => {
  const leftLines = leftText.split("\n");
  const rightLines = rightText.split("\n");
  const ops = diffSequence(leftLines, rightLines);
  const rows: DiffRow[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  for (let i = 0; i < ops.length; ) {
    const op = ops[i];
    if (op.type === "equal") {
      rows.push({
        kind: "equal",
        left: { number: leftIndex + 1, text: leftLines[leftIndex] ?? "" },
        right: { number: rightIndex + 1, text: rightLines[rightIndex] ?? "" },
      });
      leftIndex += 1;
      rightIndex += 1;
      i += 1;
      continue;
    }

    const deletes: LineData[] = [];
    const inserts: LineData[] = [];

    while (i < ops.length && ops[i].type !== "equal") {
      if (ops[i].type === "delete") {
        deletes.push({
          number: leftIndex + 1,
          text: leftLines[leftIndex] ?? "",
        });
        leftIndex += 1;
        i += 1;
        continue;
      }
      inserts.push({
        number: rightIndex + 1,
        text: rightLines[rightIndex] ?? "",
      });
      rightIndex += 1;
      i += 1;
    }

    const shouldMergeParen =
      deletes.length === 1 &&
      inserts.length > 1 &&
      shouldMergeParenInserts(inserts);

    if (shouldMergeParen) {
      const leftLine = deletes[0];
      const mergedRightText = inserts.map((line) => line.text).join("\n");
      const { leftSegments, rightSegments } = diffTokens(
        leftLine.text,
        mergedRightText,
        highlightMode
      );
      leftLine.segments = leftSegments;
      const rightSegmentsByLine = splitSegmentsByNewline(
        rightSegments,
        inserts.length
      );

      rows.push({
        kind: "replace",
        left: leftLine,
        right: { ...inserts[0], segments: rightSegmentsByLine[0] },
      });
      for (let k = 1; k < inserts.length; k += 1) {
        rows.push({
          kind: "insert",
          right: { ...inserts[k], segments: rightSegmentsByLine[k] },
        });
      }
      continue;
    }

    const count = Math.max(deletes.length, inserts.length);
    for (let k = 0; k < count; k += 1) {
      const leftLine = deletes[k];
      const rightLine = inserts[k];

      if (leftLine && rightLine) {
        const { leftSegments, rightSegments } = diffTokens(
          leftLine.text,
          rightLine.text,
          highlightMode
        );
        leftLine.segments = leftSegments;
        rightLine.segments = rightSegments;
        rows.push({ kind: "replace", left: leftLine, right: rightLine });
      } else if (leftLine) {
        rows.push({ kind: "delete", left: leftLine });
      } else if (rightLine) {
        rows.push({ kind: "insert", right: rightLine });
      }
    }
  }

  return rows;
};

const buildInlineRows = (rows: DiffRow[]): InlineRow[] => {
  const inline: InlineRow[] = [];

  rows.forEach((row, index) => {
    if (row.kind === "equal" && row.left && row.right) {
      inline.push({
        id: `equal-${index}`,
        kind: "equal",
        leftNumber: row.left.number,
        rightNumber: row.right.number,
        text: row.left.text,
      });
      return;
    }

    if (row.kind === "delete" && row.left) {
      inline.push({
        id: `delete-${index}`,
        kind: "delete",
        leftNumber: row.left.number,
        text: row.left.text,
        segments: row.left.segments,
      });
      return;
    }

    if (row.kind === "insert" && row.right) {
      inline.push({
        id: `insert-${index}`,
        kind: "insert",
        rightNumber: row.right.number,
        text: row.right.text,
        segments: row.right.segments,
      });
      return;
    }

    if (row.kind === "replace" && row.left && row.right) {
      inline.push({
        id: `replace-left-${index}`,
        kind: "delete",
        leftNumber: row.left.number,
        text: row.left.text,
        segments: row.left.segments,
      });
      inline.push({
        id: `replace-right-${index}`,
        kind: "insert",
        rightNumber: row.right.number,
        text: row.right.text,
        segments: row.right.segments,
      });
    }
  });

  return inline;
};

const renderSegments = (segments: Segment[] | undefined, text: string) => {
  if (!segments || segments.length === 0) {
    return text || " ";
  }
  return segments.map((segment, index) => (
    <span
      key={`${segment.type}-${index}`}
      className={cn(
        "break-all rounded-[4px]",
        segment.type !== "equal" && "px-0.5",
        segment.type === "insert" && "bg-emerald-500/25",
        segment.type === "delete" && "bg-rose-500/25"
      )}
    >
      {segment.value || " "}
    </span>
  ));
};

const getLeftTone = (row: DiffRow) => {
  if (row.kind === "delete" || row.kind === "replace") return "bg-rose-500/10";
  return "bg-transparent";
};

const getRightTone = (row: DiffRow) => {
  if (row.kind === "insert" || row.kind === "replace") return "bg-emerald-500/10";
  return "bg-transparent";
};

const getLeftGhost = (row: DiffRow) => {
  if (row.kind === "insert") return "diff-empty";
  return "";
};

const getRightGhost = (row: DiffRow) => {
  if (row.kind === "delete") return "diff-empty";
  return "";
};

const getLeftMarker = (row: DiffRow) => {
  if (row.kind === "delete" || row.kind === "replace") return "-";
  return "";
};

const getRightMarker = (row: DiffRow) => {
  if (row.kind === "insert" || row.kind === "replace") return "+";
  return "";
};

const getLeftMarkerTone = (row: DiffRow) => {
  if (row.kind === "delete" || row.kind === "replace") return "text-rose-500";
  return "text-[color:var(--text-tertiary)]";
};

const getRightMarkerTone = (row: DiffRow) => {
  if (row.kind === "insert" || row.kind === "replace") return "text-emerald-500";
  return "text-[color:var(--text-tertiary)]";
};

const getLeftBorder = (row: DiffRow) => {
  if (row.kind === "delete" || row.kind === "replace") {
    return "border-l-2 border-rose-500/50";
  }
  return "border-l-2 border-transparent";
};

const getRightBorder = (row: DiffRow) => {
  if (row.kind === "insert" || row.kind === "replace") {
    return "border-l-2 border-emerald-500/50";
  }
  return "border-l-2 border-transparent";
};

const getInlineMarker = (row: InlineRow) => {
  if (row.kind === "insert") return "+";
  if (row.kind === "delete") return "-";
  return "";
};

const getInlineMarkerTone = (row: InlineRow) => {
  if (row.kind === "insert") return "text-emerald-500";
  if (row.kind === "delete") return "text-rose-500";
  return "text-[color:var(--text-tertiary)]";
};

const getExportFilename = (viewMode: ViewMode) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `zenith-code-compare-${viewMode}-${timestamp}.png`;
};

const getExportBackgroundColor = () => {
  const bodyStyles = window.getComputedStyle(document.body);
  const backgroundColor = bodyStyles.backgroundColor;
  if (backgroundColor && backgroundColor !== "rgba(0, 0, 0, 0)") {
    return backgroundColor;
  }
  const theme = document.documentElement.dataset.theme;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (!theme && prefersDark);
  return isDark ? "#0b0d10" : "#f7f8fb";
};

const EXPORT_FONT_FAMILY =
  'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const EXPORT_FONT_SIZE = 12;
const EXPORT_LINE_HEIGHT = Math.round(EXPORT_FONT_SIZE * 1.5);
const EXPORT_OUTER_PADDING = 24;
const EXPORT_CARD_PADDING = 16;
const EXPORT_CELL_PADDING_X = 8;
const EXPORT_CELL_PADDING_Y = 4;
const EXPORT_COLUMN_GAP = 12;
const EXPORT_CELL_GAP = 8;
const EXPORT_MARKER_WIDTH = 16;
const EXPORT_MIN_TEXT_WIDTH = 240;
const EXPORT_FALLBACK_SPLIT_WIDTH = 960;
const EXPORT_FALLBACK_INLINE_WIDTH = 760;

const sanitizeExportText = (value: string) => value.replace(/\t/g, "  ");

const getExportColors = () => {
  const rootStyles = window.getComputedStyle(document.documentElement);
  const readVar = (name: string, fallback: string) => {
    const value = rootStyles.getPropertyValue(name).trim();
    return value || fallback;
  };

  return {
    background: getExportBackgroundColor(),
    textPrimary: readVar("--text-primary", "#0f1419"),
    textSecondary: readVar("--text-secondary", "#5b6472"),
    glassBg: readVar("--glass-bg", "rgba(255, 255, 255, 0.65)"),
    glassBorder: readVar("--glass-border", "rgba(255, 255, 255, 0.12)"),
    insertRow: "rgba(16, 185, 129, 0.12)",
    deleteRow: "rgba(244, 63, 94, 0.12)",
    insertHighlight: "rgba(16, 185, 129, 0.25)",
    deleteHighlight: "rgba(244, 63, 94, 0.25)",
    insertMarker: "#10b981",
    deleteMarker: "#f43f5e",
  };
};

type ExportColors = ReturnType<typeof getExportColors>;

const drawSegments = (
  ctx: CanvasRenderingContext2D,
  options: {
    segments?: Segment[];
    text: string;
    x: number;
    y: number;
    lineHeight: number;
    colors: ExportColors;
  }
) => {
  const { segments, text, x, y, lineHeight, colors } = options;
  const pieces = segments?.length
    ? segments
    : [{ value: text, type: "equal" as const }];
  let cursorX = x;
  const textOffset = Math.max(0, (lineHeight - EXPORT_FONT_SIZE) / 2);
  const textY = y + textOffset;
  const highlightHeight = Math.max(lineHeight - 2, EXPORT_FONT_SIZE + 4);
  const highlightY = y + (lineHeight - highlightHeight) / 2;

  pieces.forEach((segment) => {
    const value = sanitizeExportText(segment.value);
    if (!value) return;
    const width = ctx.measureText(value).width;

    if (segment.type === "insert") {
      ctx.fillStyle = colors.insertHighlight;
      ctx.fillRect(cursorX - 1, highlightY, width + 2, highlightHeight);
    }
    if (segment.type === "delete") {
      ctx.fillStyle = colors.deleteHighlight;
      ctx.fillRect(cursorX - 1, highlightY, width + 2, highlightHeight);
    }

    ctx.fillStyle = colors.textPrimary;
    ctx.fillText(value, cursorX, textY);
    cursorX += width;
  });
};

const wrapSegmentsToLines = (
  ctx: CanvasRenderingContext2D,
  segments: Segment[] | undefined,
  text: string,
  maxWidth: number
) => {
  const safeMaxWidth = Math.max(maxWidth, 1);
  const pieces = segments?.length
    ? segments
    : [{ value: text, type: "equal" as const }];
  const lines: Segment[][] = [];
  let currentLine: Segment[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    lines.push(currentLine);
    currentLine = [];
    currentWidth = 0;
  };

  const pushChar = (type: Segment["type"], char: string) => {
    const charWidth = ctx.measureText(char).width;
    if (currentWidth + charWidth > safeMaxWidth && currentLine.length > 0) {
      pushLine();
    }
    const last = currentLine[currentLine.length - 1];
    if (last && last.type === type) {
      last.value += char;
    } else {
      currentLine.push({ type, value: char });
    }
    currentWidth += charWidth;
  };

  pieces.forEach((segment) => {
    const value = sanitizeExportText(segment.value);
    if (!value) return;
    for (const char of Array.from(value)) {
      pushChar(segment.type, char);
    }
  });

  if (currentLine.length > 0) {
    pushLine();
  }

  if (lines.length === 0) {
    return [[]];
  }

  return lines;
};

const renderDiffToCanvas = (options: {
  viewMode: ViewMode;
  rows: DiffRow[];
  inlineRows: InlineRow[];
  containerWidth: number;
}) => {
  const { viewMode, rows, inlineRows, containerWidth } = options;
  const colors = getExportColors();
  const measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) {
    throw new Error("Unable to render export image.");
  }
  measureCtx.font = `${EXPORT_FONT_SIZE}px ${EXPORT_FONT_FAMILY}`;
  const numberWidth = Math.max(measureCtx.measureText("0").width * 4, 1);

  const rowHeight = EXPORT_LINE_HEIGHT + EXPORT_CELL_PADDING_Y * 2;
  let tableWidth = 0;
  let tableHeight = 0;
  let leftCellWidth = 0;
  let rightCellWidth = 0;

  if (viewMode === "split") {
    const overhead =
      EXPORT_MARKER_WIDTH +
      numberWidth +
      EXPORT_CELL_GAP * 2 +
      EXPORT_CELL_PADDING_X * 2;
    const minColumnWidth = EXPORT_MIN_TEXT_WIDTH + overhead;
    const minTableWidth = minColumnWidth * 2 + EXPORT_COLUMN_GAP;
    const hasMeasuredWidth = containerWidth > 0;
    const targetWidth = hasMeasuredWidth
      ? containerWidth
      : EXPORT_FALLBACK_SPLIT_WIDTH;
    tableWidth = hasMeasuredWidth ? targetWidth : Math.max(targetWidth, minTableWidth);
    leftCellWidth = Math.floor((tableWidth - EXPORT_COLUMN_GAP) / 2);
    rightCellWidth = tableWidth - EXPORT_COLUMN_GAP - leftCellWidth;
    const textWidth = Math.max(leftCellWidth - overhead, 1);

    const rowLayouts = rows.map((row) => {
      const leftLines = row.left
        ? wrapSegmentsToLines(
            measureCtx,
            row.left.segments,
            row.left.text,
            textWidth
          )
        : [[]];
      const rightLines = row.right
        ? wrapSegmentsToLines(
            measureCtx,
            row.right.segments,
            row.right.text,
            textWidth
          )
        : [[]];
      const lineCount = Math.max(leftLines.length, rightLines.length);
      return {
        row,
        leftLines,
        rightLines,
        lineCount,
        height: lineCount * EXPORT_LINE_HEIGHT + EXPORT_CELL_PADDING_Y * 2,
      };
    });

    tableHeight =
      rowLayouts.length === 0
        ? rowHeight
        : rowLayouts.reduce((total, layout) => total + layout.height, 0);

    const cardWidth = tableWidth + EXPORT_CARD_PADDING * 2;
    const cardHeight = tableHeight + EXPORT_CARD_PADDING * 2;
    const canvasWidth = cardWidth + EXPORT_OUTER_PADDING * 2;
    const canvasHeight = cardHeight + EXPORT_OUTER_PADDING * 2;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(canvasWidth * scale);
    canvas.height = Math.ceil(canvasHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to render export image.");
    }

    ctx.scale(scale, scale);
    ctx.font = `${EXPORT_FONT_SIZE}px ${EXPORT_FONT_FAMILY}`;
    ctx.textBaseline = "top";

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cardX = EXPORT_OUTER_PADDING;
    const cardY = EXPORT_OUTER_PADDING;
    ctx.fillStyle = colors.glassBg;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
    ctx.strokeStyle = colors.glassBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardWidth - 1, cardHeight - 1);

    const tableX = cardX + EXPORT_CARD_PADDING;
    const tableY = cardY + EXPORT_CARD_PADDING;

    const leftX = tableX;
    const rightX = tableX + leftCellWidth + EXPORT_COLUMN_GAP;

    let cursorY = tableY;
    rowLayouts.forEach((layout) => {
      const { row, leftLines, rightLines, lineCount, height } = layout;
      if (row.kind === "delete" || row.kind === "replace") {
        ctx.fillStyle = colors.deleteRow;
        ctx.fillRect(leftX, cursorY, leftCellWidth, height);
      }
      if (row.kind === "insert" || row.kind === "replace") {
        ctx.fillStyle = colors.insertRow;
        ctx.fillRect(rightX, cursorY, rightCellWidth, height);
      }

      const markerY =
        cursorY +
        EXPORT_CELL_PADDING_Y +
        Math.max(0, (EXPORT_LINE_HEIGHT - EXPORT_FONT_SIZE) / 2);
      const leftMarkerX =
        leftX + EXPORT_CELL_PADDING_X + EXPORT_MARKER_WIDTH / 2;
      const leftNumberX =
        leftX +
        EXPORT_CELL_PADDING_X +
        EXPORT_MARKER_WIDTH +
        EXPORT_CELL_GAP +
        numberWidth;
      const leftTextX =
        leftX +
        EXPORT_CELL_PADDING_X +
        EXPORT_MARKER_WIDTH +
        numberWidth +
        EXPORT_CELL_GAP * 2;

      if (row.left) {
        const marker = getLeftMarker(row);
        if (marker) {
          ctx.fillStyle = colors.deleteMarker;
          ctx.textAlign = "center";
          ctx.fillText(marker, leftMarkerX, markerY);
        }
        if (row.left.number !== undefined) {
          ctx.fillStyle = colors.textSecondary;
          ctx.textAlign = "right";
          ctx.fillText(String(row.left.number), leftNumberX, markerY);
        }
      }

      const rightMarkerX =
        rightX + EXPORT_CELL_PADDING_X + EXPORT_MARKER_WIDTH / 2;
      const rightNumberX =
        rightX +
        EXPORT_CELL_PADDING_X +
        EXPORT_MARKER_WIDTH +
        EXPORT_CELL_GAP +
        numberWidth;
      const rightTextX =
        rightX +
        EXPORT_CELL_PADDING_X +
        EXPORT_MARKER_WIDTH +
        numberWidth +
        EXPORT_CELL_GAP * 2;

      if (row.right) {
        const marker = getRightMarker(row);
        if (marker) {
          ctx.fillStyle = colors.insertMarker;
          ctx.textAlign = "center";
          ctx.fillText(marker, rightMarkerX, markerY);
        }
        if (row.right.number !== undefined) {
          ctx.fillStyle = colors.textSecondary;
          ctx.textAlign = "right";
          ctx.fillText(String(row.right.number), rightNumberX, markerY);
        }
      }

      for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
        const lineY =
          cursorY +
          EXPORT_CELL_PADDING_Y +
          lineIndex * EXPORT_LINE_HEIGHT;
        const leftSegments = leftLines[lineIndex];
        if (leftSegments) {
          ctx.textAlign = "left";
          drawSegments(ctx, {
            segments: leftSegments,
            text: "",
            x: leftTextX,
            y: lineY,
            lineHeight: EXPORT_LINE_HEIGHT,
            colors,
          });
        }
        const rightSegments = rightLines[lineIndex];
        if (rightSegments) {
          ctx.textAlign = "left";
          drawSegments(ctx, {
            segments: rightSegments,
            text: "",
            x: rightTextX,
            y: lineY,
            lineHeight: EXPORT_LINE_HEIGHT,
            colors,
          });
        }
      }

      cursorY += height;
    });

    return canvas;
  } else {
    const overhead =
      EXPORT_MARKER_WIDTH +
      numberWidth * 2 +
      EXPORT_CELL_GAP * 3 +
      EXPORT_CELL_PADDING_X * 2;
    const minTableWidth = EXPORT_MIN_TEXT_WIDTH + overhead;
    const hasMeasuredWidth = containerWidth > 0;
    const targetWidth = hasMeasuredWidth
      ? containerWidth
      : EXPORT_FALLBACK_INLINE_WIDTH;
    tableWidth = hasMeasuredWidth ? targetWidth : Math.max(targetWidth, minTableWidth);
    const textWidth = Math.max(tableWidth - overhead, 1);

    const rowLayouts = inlineRows.map((row) => {
      const lines = wrapSegmentsToLines(
        measureCtx,
        row.segments,
        row.text,
        textWidth
      );
      return {
        row,
        lines,
        height: lines.length * EXPORT_LINE_HEIGHT + EXPORT_CELL_PADDING_Y * 2,
      };
    });

    tableHeight =
      rowLayouts.length === 0
        ? rowHeight
        : rowLayouts.reduce((total, layout) => total + layout.height, 0);

    const cardWidth = tableWidth + EXPORT_CARD_PADDING * 2;
    const cardHeight = tableHeight + EXPORT_CARD_PADDING * 2;
    const canvasWidth = cardWidth + EXPORT_OUTER_PADDING * 2;
    const canvasHeight = cardHeight + EXPORT_OUTER_PADDING * 2;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(canvasWidth * scale);
    canvas.height = Math.ceil(canvasHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to render export image.");
    }

    ctx.scale(scale, scale);
    ctx.font = `${EXPORT_FONT_SIZE}px ${EXPORT_FONT_FAMILY}`;
    ctx.textBaseline = "top";

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cardX = EXPORT_OUTER_PADDING;
    const cardY = EXPORT_OUTER_PADDING;
    ctx.fillStyle = colors.glassBg;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
    ctx.strokeStyle = colors.glassBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardWidth - 1, cardHeight - 1);

    const tableX = cardX + EXPORT_CARD_PADDING;
    const tableY = cardY + EXPORT_CARD_PADDING;

    let cursorY = tableY;
    rowLayouts.forEach((layout) => {
      const { row, lines, height } = layout;
      if (row.kind === "insert") {
        ctx.fillStyle = colors.insertRow;
        ctx.fillRect(tableX, cursorY, tableWidth, height);
      }
      if (row.kind === "delete") {
        ctx.fillStyle = colors.deleteRow;
        ctx.fillRect(tableX, cursorY, tableWidth, height);
      }

      const markerY =
        cursorY +
        EXPORT_CELL_PADDING_Y +
        Math.max(0, (EXPORT_LINE_HEIGHT - EXPORT_FONT_SIZE) / 2);
      const markerX =
        tableX + EXPORT_CELL_PADDING_X + EXPORT_MARKER_WIDTH / 2;
      const leftNumberX =
        tableX +
        EXPORT_CELL_PADDING_X +
        EXPORT_MARKER_WIDTH +
        EXPORT_CELL_GAP +
        numberWidth;
      const rightNumberX =
        tableX +
        EXPORT_CELL_PADDING_X +
        EXPORT_MARKER_WIDTH +
        EXPORT_CELL_GAP +
        numberWidth * 2 +
        EXPORT_CELL_GAP;
      const textX =
        tableX +
        EXPORT_CELL_PADDING_X +
        EXPORT_MARKER_WIDTH +
        EXPORT_CELL_GAP +
        numberWidth * 2 +
        EXPORT_CELL_GAP * 2;

      const marker = getInlineMarker(row);
      if (marker) {
        ctx.fillStyle =
          row.kind === "insert" ? colors.insertMarker : colors.deleteMarker;
        ctx.textAlign = "center";
        ctx.fillText(marker, markerX, markerY);
      }
      if (row.leftNumber !== undefined) {
        ctx.fillStyle = colors.textSecondary;
        ctx.textAlign = "right";
        ctx.fillText(String(row.leftNumber), leftNumberX, markerY);
      }
      if (row.rightNumber !== undefined) {
        ctx.fillStyle = colors.textSecondary;
        ctx.textAlign = "right";
        ctx.fillText(String(row.rightNumber), rightNumberX, markerY);
      }

      lines.forEach((lineSegments, lineIndex) => {
        const lineY =
          cursorY +
          EXPORT_CELL_PADDING_Y +
          lineIndex * EXPORT_LINE_HEIGHT;
        ctx.textAlign = "left";
        drawSegments(ctx, {
          segments: lineSegments,
          text: "",
          x: textX,
          y: lineY,
          lineHeight: EXPORT_LINE_HEIGHT,
          colors,
        });
      });

      cursorY += height;
    });

    return canvas;
  }
};

export default function CodeCompareTool() {
  const [left, setLeft] = useState(SAMPLE_LEFT);
  const [right, setRight] = useState(SAMPLE_RIGHT);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [realtimeDiff, setRealtimeDiff] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const diffContainerRef = useRef<HTMLDivElement | null>(null);
  const emptyCellRefs = useRef(new Map<string, HTMLDivElement>());
  const deferredLeft = useDeferredValue(left);
  const deferredRight = useDeferredValue(right);
  const registerEmptyCell = useCallback((key: string, node: HTMLDivElement | null) => {
    if (node) {
      emptyCellRefs.current.set(key, node);
      return;
    }
    emptyCellRefs.current.delete(key);
  }, []);

  const rows = useMemo(
    () =>
      hasCompared
        ? buildDiffRows(
            deferredLeft,
            deferredRight,
            realtimeDiff ? "char" : "token"
          )
        : [],
    [deferredLeft, deferredRight, realtimeDiff, hasCompared]
  );

  const inlineRows = useMemo(() => buildInlineRows(rows), [rows]);

  useLayoutEffect(() => {
    if (!hasCompared || viewMode !== "split") return;
    const container = diffContainerRef.current;
    if (!container) return;

    const updateOffsets = () => {
      const containerRect = container.getBoundingClientRect();
      emptyCellRefs.current.forEach((node) => {
        const rect = node.getBoundingClientRect();
        const offset = rect.top - containerRect.top + container.scrollTop;
        node.style.setProperty("--diff-offset", `${Math.round(offset)}px`);
      });
    };

    updateOffsets();
    const observer = new ResizeObserver(updateOffsets);
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasCompared, viewMode, rows]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let changed = 0;
    rows.forEach((row) => {
      if (row.kind === "insert") added += 1;
      if (row.kind === "delete") removed += 1;
      if (row.kind === "replace") changed += 1;
    });
    return { added, removed, changed };
  }, [rows]);

  const summary =
    stats.added === 0 && stats.removed === 0 && stats.changed === 0
      ? "No differences"
      : `${stats.changed} changed · ${stats.added} added · ${stats.removed} removed`;

  const swapSides = () => {
    setLeft(right);
    setRight(left);
  };

  const clearAll = () => {
    setLeft("");
    setRight("");
    setHasCompared(false);
    setExportError(null);
  };

  const exportDiffImage = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const filename = getExportFilename(viewMode);
      const fallbackWidth =
        viewMode === "split"
          ? EXPORT_FALLBACK_SPLIT_WIDTH
          : EXPORT_FALLBACK_INLINE_WIDTH;
      const containerWidth =
        diffContainerRef.current?.clientWidth ?? fallbackWidth;
      const canvas = renderDiffToCanvas({
        viewMode,
        rows,
        inlineRows,
        containerWidth,
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Unable to export image."));
        }, "image/png");
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to export image.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, [inlineRows, rows, viewMode]);

  return (
    <div className="flex h-full flex-col gap-5">
      {hasCompared ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={cn(
                  "rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-xs transition-colors",
                  viewMode === "split"
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                Split view
              </button>
              <button
                type="button"
                onClick={() => setViewMode("inline")}
                className={cn(
                  "rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-xs transition-colors",
                  viewMode === "inline"
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                Inline view
              </button>
              <button
                type="button"
                onClick={() => setRealtimeDiff((prev) => !prev)}
                className={cn(
                  "rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-xs transition-colors",
                  realtimeDiff
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                Realtime diff
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="text-xs text-[color:var(--text-secondary)]"
                aria-live="polite"
              >
                {summary}
              </p>
              <button
                type="button"
                onClick={exportDiffImage}
                disabled={isExporting}
                className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-xs text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--glass-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? "Exporting..." : "Export PNG"}
              </button>
            </div>
          </div>
          {exportError ? (
            <p className="text-xs text-rose-500" role="status">
              {exportError}
            </p>
          ) : null}
          <div className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                Diff
              </p>
              <span className="text-xs text-[color:var(--text-secondary)]">
                {viewMode === "split" ? "Side-by-side" : "Inline"}
              </span>
            </div>
            <div
              className="mt-3 flex-1 overflow-auto"
              ref={diffContainerRef}
              data-diff-scroll="true"
            >
              {viewMode === "split" ? (
                <div className="flex w-full min-w-0 flex-col text-xs font-mono">
                  {rows.map((row, index) => {
                    const leftLine = row.left;
                    const rightLine = row.right;
                    const isLeftEmpty = row.kind === "insert";
                    const isRightEmpty = row.kind === "delete";
                    return (
                      <div key={`row-${index}`} className="grid grid-cols-2 gap-3">
                        <div
                          ref={
                            isLeftEmpty
                              ? (node) => registerEmptyCell(`left-${index}`, node)
                              : undefined
                          }
                          className={cn(
                            "grid grid-cols-[16px_4ch_1fr] items-start gap-2 px-2 py-1",
                            getLeftTone(row),
                            getLeftBorder(row),
                            getLeftGhost(row)
                          )}
                        >
                          <span
                            className={cn(
                              "text-center text-[10px] font-semibold leading-5",
                              getLeftMarkerTone(row)
                            )}
                          >
                            {getLeftMarker(row)}
                          </span>
                          <span className="text-right text-[color:var(--text-secondary)]">
                            {leftLine?.number ?? ""}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap break-all">
                            {leftLine
                              ? renderSegments(leftLine.segments, leftLine.text)
                              : ""}
                          </span>
                        </div>
                        <div
                          ref={
                            isRightEmpty
                              ? (node) => registerEmptyCell(`right-${index}`, node)
                              : undefined
                          }
                          className={cn(
                            "grid grid-cols-[16px_4ch_1fr] items-start gap-2 px-2 py-1",
                            getRightTone(row),
                            getRightBorder(row),
                            getRightGhost(row)
                          )}
                        >
                          <span
                            className={cn(
                              "text-center text-[10px] font-semibold leading-5",
                              getRightMarkerTone(row)
                            )}
                          >
                            {getRightMarker(row)}
                          </span>
                          <span className="text-right text-[color:var(--text-secondary)]">
                            {rightLine?.number ?? ""}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap break-all">
                            {rightLine
                              ? renderSegments(rightLine.segments, rightLine.text)
                              : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex w-full min-w-0 flex-col text-xs font-mono">
                  {inlineRows.map((row) => (
                    <div
                      key={row.id}
                      className={cn(
                        "grid grid-cols-[16px_4ch_4ch_1fr] gap-2 px-2 py-1",
                        row.kind === "insert" && "bg-emerald-500/10",
                        row.kind === "delete" && "bg-rose-500/10"
                      )}
                    >
                      <span
                        className={cn(
                          "text-center text-[10px] font-semibold leading-5",
                          getInlineMarkerTone(row)
                        )}
                      >
                        {getInlineMarker(row)}
                      </span>
                      <span className="text-right text-[color:var(--text-secondary)]">
                        {row.leftNumber ?? ""}
                      </span>
                      <span className="text-right text-[color:var(--text-secondary)]">
                        {row.rightNumber ?? ""}
                      </span>
                      <span className="whitespace-pre-wrap break-all">
                        {renderSegments(row.segments, row.text)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setHasCompared(true)}
          className="rounded-full bg-[color:var(--accent-blue)] px-3 py-1 text-xs text-white transition-colors hover:bg-[#0b5bd3]"
        >
          Compare
        </button>
        <button
          type="button"
          onClick={swapSides}
          className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-xs text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
        >
          Swap
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-full px-3 py-1 text-xs text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
        >
          Clear
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-h-[clamp(260px,45vh,520px)] flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Original
          </p>
          <textarea
            value={left}
            onChange={(event) => setLeft(event.target.value)}
            spellCheck={false}
            placeholder="Paste original code..."
            className="mt-3 min-h-[clamp(220px,38vh,480px)] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 font-mono text-xs leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
        <div className="flex min-h-[clamp(260px,45vh,520px)] flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Updated
          </p>
          <textarea
            value={right}
            onChange={(event) => setRight(event.target.value)}
            spellCheck={false}
            placeholder="Paste updated code..."
            className="mt-3 min-h-[clamp(220px,38vh,480px)] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 font-mono text-xs leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
      </div>
    </div>
  );
}
