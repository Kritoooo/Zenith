import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const basePath = isGitHubPages ? '/Zenith' : '';

const crossOriginHeaders = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
];

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/tool/anime-upscale/:path*',
        headers: crossOriginHeaders,
      },
      {
        source: '/tool/aigc-detector/:path*',
        headers: crossOriginHeaders,
      },
      {
        source: '/tool/paddleocr-onnx/:path*',
        headers: crossOriginHeaders,
      },
      {
        source: '/_next/static/:path*',
        headers: crossOriginHeaders,
      },
    ];
  },
};

export default nextConfig;
