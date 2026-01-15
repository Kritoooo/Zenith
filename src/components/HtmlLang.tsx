"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

import { toHtmlLang } from "@/i18n/config";

export function HtmlLang() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = toHtmlLang(locale);
  }, [locale]);

  return null;
}
