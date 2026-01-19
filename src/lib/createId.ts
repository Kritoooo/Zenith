export const createId = (prefix = "id") => {
  const cryptoRef =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined)
      : undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  const base = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return prefix ? `${prefix}-${base}` : base;
};
