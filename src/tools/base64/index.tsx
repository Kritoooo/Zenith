import { ToolPlaceholder } from "@/components/ToolPlaceholder";

export default function Base64Tool() {
  return (
    <ToolPlaceholder
      primaryAction="Encode"
      secondaryAction="Decode"
      note="Instant output"
    />
  );
}
