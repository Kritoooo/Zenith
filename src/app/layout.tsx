import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";
import IsolationServiceWorker from "@/components/IsolationServiceWorker";
import { defaultLocale, locales, toHtmlLang, type Locale } from "@/i18n/config";

const normalizeLocale = (value: string) => value.trim().toLowerCase();

const resolveHtmlLangLocale = (): Locale => {
  const fromEnv = normalizeLocale(process.env.HTML_LANG_LOCALE ?? "");
  if (fromEnv && locales.includes(fromEnv as Locale)) {
    return fromEnv as Locale;
  }
  return defaultLocale;
};

export const metadata: Metadata = {
  title: "Zenith",
  description: "Apple-style bento grid for precision tools.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const htmlLang = toHtmlLang(resolveHtmlLangLocale());

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{`
(() => {
  try {
    const storageKey = "zenith-theme";
    const saved = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    // Ignore theme init errors.
  }
})();
        `}</Script>
      </head>
      <body className="min-h-screen antialiased">
        <IsolationServiceWorker />
        {children}
      </body>
    </html>
  );
}
