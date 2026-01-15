import {
  JsonValue,
  SummaryLabels,
  buildPath,
  formatKey,
  formatPrimitive,
  getNodeSummary,
  getPrimitiveTone,
  isJsonBranch,
} from "./jsonUtils";

type JsonTreeProps = {
  value: JsonValue;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
  summaryLabels: SummaryLabels;
  ariaLabels: {
    expand: string;
    collapse: string;
  };
};

type JsonNodeProps = {
  label?: string;
  value: JsonValue;
  path: string;
  depth: number;
  isLast: boolean;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
  summaryLabels: SummaryLabels;
  ariaLabels: {
    expand: string;
    collapse: string;
  };
};

function JsonNode({
  label,
  value,
  path,
  depth,
  isLast,
  collapsedPaths,
  onToggle,
  summaryLabels,
  ariaLabels,
}: JsonNodeProps) {
  const isBranch = isJsonBranch(value);
  const isArray = Array.isArray(value);
  const entries = isBranch
    ? isArray
      ? value.map((item, index) => [index, item] as const)
      : (Object.entries(value) as [string, JsonValue][])
    : [];
  const hasChildren = entries.length > 0;
  const isCollapsed = collapsedPaths.has(path);
  const comma = isLast ? "" : ",";
  const opener = isArray ? "[" : "{";
  const closer = isArray ? "]" : "}";
  const summary = getNodeSummary(value, summaryLabels);

  const renderControl = (interactive: boolean) =>
    interactive ? (
      <button
        type="button"
        onClick={() => onToggle(path)}
        aria-label={isCollapsed ? ariaLabels.expand : ariaLabels.collapse}
        className="mt-[2px] flex h-4 w-4 items-center justify-center rounded border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[10px] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
      >
        {isCollapsed ? "+" : "-"}
      </button>
    ) : (
      <span className="mt-[2px] inline-flex h-4 w-4" aria-hidden="true" />
    );

  const renderLabel = () =>
    label !== undefined ? (
      <>
        <span className="text-[color:var(--accent-blue)]">
          {formatKey(label)}
        </span>
        <span className="text-[color:var(--text-secondary)]">: </span>
      </>
    ) : null;

  if (!isBranch) {
    return (
      <div
        className="flex min-w-fit items-start gap-2"
        style={{ paddingLeft: depth * 16 }}
      >
        {renderControl(false)}
        <div className="flex min-w-fit items-center gap-1">
          {renderLabel()}
          <span className={getPrimitiveTone(value)}>
            {formatPrimitive(value)}
            {comma}
          </span>
        </div>
      </div>
    );
  }

  if (!hasChildren) {
    return (
      <div
        className="flex min-w-fit items-start gap-2"
        style={{ paddingLeft: depth * 16 }}
      >
        {renderControl(false)}
        <div className="flex min-w-fit items-center gap-1">
          {renderLabel()}
          <span className="text-[color:var(--text-secondary)]">
            {opener}
            {closer}
            {comma}
          </span>
        </div>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div
        className="flex min-w-fit items-start gap-2"
        style={{ paddingLeft: depth * 16 }}
      >
        {renderControl(true)}
        <div className="flex min-w-fit items-center gap-1">
          {renderLabel()}
          <span className="text-[color:var(--text-secondary)]">
            {opener}...{closer}
            {comma}
          </span>
          <span className="ml-2 text-[10px] text-[color:var(--text-secondary)]">
            {summary}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex min-w-fit items-start gap-2"
        style={{ paddingLeft: depth * 16 }}
      >
        {renderControl(true)}
        <div className="flex min-w-fit items-center gap-1">
          {renderLabel()}
          <span className="text-[color:var(--text-secondary)]">{opener}</span>
        </div>
      </div>
      {entries.map(([key, child], index) => {
        const childPath = buildPath(path, key);
        const childLabel = isArray ? undefined : (key as string);
        const childIsLast = index === entries.length - 1;
        return (
          <JsonNode
            key={childPath}
            label={childLabel}
            value={child}
            path={childPath}
            depth={depth + 1}
            isLast={childIsLast}
            collapsedPaths={collapsedPaths}
            onToggle={onToggle}
            summaryLabels={summaryLabels}
            ariaLabels={ariaLabels}
          />
        );
      })}
      <div
        className="flex min-w-fit items-start gap-2"
        style={{ paddingLeft: depth * 16 }}
      >
        {renderControl(false)}
        <div className="flex min-w-fit items-center gap-1">
          <span className="text-[color:var(--text-secondary)]">
            {closer}
            {comma}
          </span>
        </div>
      </div>
    </div>
  );
}

export function JsonTree({
  value,
  collapsedPaths,
  onToggle,
  summaryLabels,
  ariaLabels,
}: JsonTreeProps) {
  return (
    <JsonNode
      value={value}
      path="$"
      depth={0}
      isLast
      collapsedPaths={collapsedPaths}
      onToggle={onToggle}
      summaryLabels={summaryLabels}
      ariaLabels={ariaLabels}
    />
  );
}
