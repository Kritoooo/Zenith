import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";
import IsolationServiceWorker from "@/components/IsolationServiceWorker";
import { defaultLocale, toHtmlLang } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Zenith",
  description: "Apple-style bento grid for precision tools.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const htmlLang = toHtmlLang(defaultLocale);

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
