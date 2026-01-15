"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseClipboardOptions<T> = {
  timeoutMs?: number;
  onError?: (error: unknown) => void;
  onSuccess?: (payload: T) => void;
  resetOnError?: boolean;
};

export function useClipboard<T = true>(
  options: UseClipboardOptions<T> = {}
) {
  const {
    timeoutMs = 1400,
    onError,
    onSuccess,
    resetOnError = true,
  } = options;
  const [copied, setCopied] = useState<T | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setCopied(null);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const copy = useCallback(
    async (text: string, payload?: T) => {
      if (!text) return false;
      try {
        if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
          throw new Error("CLIPBOARD_UNAVAILABLE");
        }
        await navigator.clipboard.writeText(text);
        const next = (payload ?? (true as T)) as T;
        setCopied(next);
        if (onSuccess) onSuccess(next);
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          setCopied(null);
          timerRef.current = null;
        }, timeoutMs);
        return true;
      } catch (err) {
        if (resetOnError) {
          reset();
        }
        if (onError) onError(err);
        return false;
      }
    },
    [clearTimer, onError, onSuccess, reset, resetOnError, timeoutMs]
  );

  return { copied, copy, reset };
}
