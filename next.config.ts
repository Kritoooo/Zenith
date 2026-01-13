import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const isVercel = process.env.VERCEL === "1";
const isStaticExport = isGitHubPages || isVercel;
const basePath = isGitHubPages ? "/Zenith" : "";

const crossOriginHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
];

const coiToolPaths = [
  '/tool/anime-upscale/:path*',
  '/tool/aigc-detector/:path*',
  '/tool/paddleocr-onnx/:path*',
];

const coiToolSources = [
  ...coiToolPaths,
  ...coiToolPaths.map((path) => `/:locale${path}`),
];

const nextConfig: NextConfig = {
  basePath,
  trailingSlash: true,
  ...(isStaticExport ? { output: "export" } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      ...coiToolSources.map((source) => ({
        source,
        headers: crossOriginHeaders,
      })),
      {
        source: '/_next/static/:path*',
        headers: crossOriginHeaders,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
