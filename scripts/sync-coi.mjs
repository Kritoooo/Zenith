import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const COI_SLUGS_PATH = path.join(ROOT, "src", "tools", "coi-slugs.json");
const HEADERS_PATH = path.join(ROOT, "public", "_headers");
const VERCEL_PATH = path.join(ROOT, "vercel.json");

const crossOriginHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const readJson = (filePath) =>
  JSON.parse(fs.readFileSync(filePath, "utf8"));

const ensureSlugList = (value) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("COI slug list must be an array of strings.");
  }
  return value;
};

const buildHeadersFile = (slugs) => {
  const lines = [];
  slugs.forEach((slug) => {
    const base = `/tool/${slug}`;
    lines.push(
      base,
      "  Cross-Origin-Opener-Policy: same-origin",
      "  Cross-Origin-Embedder-Policy: require-corp",
      "",
      `${base}/*`,
      "  Cross-Origin-Opener-Policy: same-origin",
      "  Cross-Origin-Embedder-Policy: require-corp",
      ""
    );
  });
  lines.push(
    "/_next/static/*",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Embedder-Policy: require-corp",
    ""
  );
  return `${lines.join("\n")}\n`;
};

const buildVercelHeaders = (slugs) => {
  const headers = [];
  slugs.forEach((slug) => {
    headers.push({
      source: `/tool/${slug}/:path*`,
      headers: crossOriginHeaders,
    });
    headers.push({
      source: `/:locale/tool/${slug}/:path*`,
      headers: crossOriginHeaders,
    });
  });
  headers.push({
    source: "/_next/static/:path*",
    headers: crossOriginHeaders,
  });
  return headers;
};

const slugs = ensureSlugList(readJson(COI_SLUGS_PATH));

fs.writeFileSync(HEADERS_PATH, buildHeadersFile(slugs));

const vercelConfig = readJson(VERCEL_PATH);
vercelConfig.headers = buildVercelHeaders(slugs);
fs.writeFileSync(VERCEL_PATH, `${JSON.stringify(vercelConfig, null, 4)}\n`);
