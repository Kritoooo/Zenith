import type { Metadata } from "next";

import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
