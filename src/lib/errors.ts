type FormatErrorOptions = {
  includeDetails?: boolean;
};

export const formatErrorMessage = (
  err: unknown,
  fallback: string,
  options?: FormatErrorOptions
) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
    if (options?.includeDetails ?? true) {
      try {
        return JSON.stringify(err);
      } catch {
        return fallback;
      }
    }
  }
  return fallback;
};
