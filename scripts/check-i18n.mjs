import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MESSAGES_DIR = path.join(ROOT, "messages");
const SRC_DIR = path.join(ROOT, "src");

const skipDirs = new Set(["node_modules", ".next", "out", "dist", ".git"]);
const srcExts = new Set([".ts", ".tsx"]);

const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

const flatten = (obj, prefix = "", out = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      flatten(value, fullKey, out);
    } else {
      out[fullKey] = value;
    }
  }
  return out;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const listFiles = (dir, results = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(fullPath, results);
    } else if (srcExts.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
};

const getLineStarts = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
};

const getLineNumber = (lineStarts, index) => {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > index) {
        return mid + 1;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return 1;
};

const messagesFiles = fs
  .readdirSync(MESSAGES_DIR)
  .filter((name) => name.endsWith(".json"));

if (messagesFiles.length === 0) {
  console.error("No messages/*.json files found.");
  process.exit(1);
}

const locales = messagesFiles.map((name) => path.basename(name, ".json"));
const messages = Object.fromEntries(
  locales.map((locale) => [
    locale,
    readJson(path.join(MESSAGES_DIR, `${locale}.json`)),
  ])
);
const flatMessages = Object.fromEntries(
  Object.entries(messages).map(([locale, data]) => [locale, flatten(data)])
);

const useTranslationsRe = /\bconst\s+([A-Za-z_]\w*)\s*=\s*useTranslations\s*\(\s*(?:'([^']+)'|"([^"]+)")?\s*\)/g;
const callRe =
  /\b([A-Za-z_]\w*)\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([\s\S]*?)`)\s*(?:,|\))/g;

const foundKeys = new Map(); // key -> [{file, line}]

for (const filePath of listFiles(SRC_DIR)) {
  const text = fs.readFileSync(filePath, "utf8");
  const lineStarts = getLineStarts(text);
  const decls = new Map();

  for (const match of text.matchAll(useTranslationsRe)) {
    const varName = match[1];
    const ns = match[2] || match[3] || null;
    const pos = match.index ?? 0;
    if (!decls.has(varName)) decls.set(varName, []);
    decls.get(varName).push({ pos, ns });
  }

  if (decls.size === 0) continue;

  for (const [varName, list] of decls.entries()) {
    list.sort((a, b) => a.pos - b.pos);
    decls.set(varName, list);
  }

  for (const match of text.matchAll(callRe)) {
    const varName = match[1];
    if (!decls.has(varName)) continue;
    const key = match[2] || match[3] || match[4] || "";
    if (!key || key.includes('${')) continue;
    const pos = match.index ?? 0;

    const list = decls.get(varName);
    let ns = null;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].pos < pos) {
        ns = list[i].ns;
        break;
      }
    }

    const fullKey = ns ? `${ns}.${key}` : key;
    const relPath = path.relative(ROOT, filePath);
    const line = getLineNumber(lineStarts, pos);

    if (!foundKeys.has(fullKey)) foundKeys.set(fullKey, []);
    foundKeys.get(fullKey).push({ file: relPath, line });
  }
}

const missingByLocale = {};
for (const locale of locales) {
  const missing = [];
  const entries = flatMessages[locale];
  for (const [key, locations] of foundKeys.entries()) {
    if (!(key in entries)) {
      missing.push({ key, locations });
    }
  }
  missingByLocale[locale] = missing;
}

let hasMissing = false;
for (const locale of locales) {
  const missing = missingByLocale[locale];
  if (missing.length === 0) continue;
  hasMissing = true;
  console.error(`\nMissing translations for locale "${locale}": ${missing.length}`);
  for (const item of missing) {
    const loc = item.locations[0];
    const suffix = loc ? ` (${loc.file}:${loc.line})` : "";
    console.error(`  - ${item.key}${suffix}`);
  }
}

if (hasMissing) {
  process.exit(1);
}

console.log(`i18n check passed for locales: ${locales.join(', ')}`);
