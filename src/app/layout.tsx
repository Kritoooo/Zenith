import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";
import IsolationServiceWorker from "@/components/IsolationServiceWorker";

export const metadata: Metadata = {
  title: "Zenith",
  description: "Apple-style bento grid for precision tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
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
