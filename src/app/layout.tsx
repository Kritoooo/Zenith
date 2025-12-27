import type { Metadata } from "next";

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
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <IsolationServiceWorker />
        {children}
      </body>
    </html>
  );
}
