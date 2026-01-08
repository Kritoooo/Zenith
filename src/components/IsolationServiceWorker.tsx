"use client";

import { useEffect } from "react";

const RELOAD_KEY = "zenith-coi-reload";
const COI_TOOL_PATHS = [
  "/tool/anime-upscale",
  "/tool/aigc-detector",
  "/tool/paddleocr-onnx",
];

const getBasePath = () => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
};

const normalizePathname = (pathname: string, basePath: string) => {
  if (basePath && pathname.startsWith(basePath)) {
    const trimmed = pathname.slice(basePath.length);
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
  return pathname;
};

const getActiveScope = (pathname: string, basePath: string) => {
  const normalized = normalizePathname(pathname, basePath);
  const matched = COI_TOOL_PATHS.find(
    (path) => normalized === path || normalized.startsWith(`${path}/`)
  );
  if (!matched) return null;
  if (!basePath) return "/";
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
};

export default function IsolationServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const basePath = getBasePath();
    const scope = getActiveScope(window.location.pathname, basePath);
    if (!scope) return;
    const swUrl = `${basePath}/coi-serviceworker.js`;

    const markReloaded = () => {
      try {
        sessionStorage.setItem(RELOAD_KEY, "true");
      } catch {
        // Ignore storage errors (private mode, disabled storage).
      }
    };

    const clearReloaded = () => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        // Ignore storage errors.
      }
    };

    const shouldReload = () => {
      if (window.crossOriginIsolated) {
        clearReloaded();
        return false;
      }
      try {
        return sessionStorage.getItem(RELOAD_KEY) !== "true";
      } catch {
        return false;
      }
    };

    const triggerReload = () => {
      if (!shouldReload()) return;
      markReloaded();
      window.location.reload();
    };

    navigator.serviceWorker
      .register(swUrl, { scope })
      .then((registration) => {
        if (window.crossOriginIsolated) {
          clearReloaded();
          return;
        }
        if (registration.active) {
          triggerReload();
          return;
        }
        navigator.serviceWorker.addEventListener("controllerchange", triggerReload, {
          once: true,
        });
      })
      .catch((error) => {
        console.warn("Service worker registration failed.", error);
      });
  }, []);

  return null;
}
