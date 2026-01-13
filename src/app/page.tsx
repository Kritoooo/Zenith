"use client";

import { useEffect } from "react";

import { defaultLocale } from "@/i18n/config";

export default function RootPage() {
  useEffect(() => {
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
    const target = `${basePath}/${defaultLocale}`;
    window.location.replace(target);
  }, []);

  return null;
}
