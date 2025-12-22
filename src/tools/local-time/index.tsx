import { ToolPlaceholder } from "@/components/ToolPlaceholder";

export default function LocalTimeTool() {
  return (
    <ToolPlaceholder
      primaryAction="Refresh"
      secondaryAction="Copy"
      note="Local timezone"
    />
  );
}
