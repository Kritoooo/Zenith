"use client";

import { useEffect } from "react";

const RELOAD_KEY = "zenith-coi-reload";

const getBasePath = () => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
};

export default function IsolationServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const basePath = getBasePath();
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
      .register(swUrl)
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
