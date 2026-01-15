import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const MESSAGES_DIR = path.join(ROOT, "messages");
const OUT_DIR = path.join(ROOT, "out");
const TEMP_DIR = path.join(ROOT, ".out-locales");
const MERGED_DIR = path.join(TEMP_DIR, "merged");

const readLocales = () =>
  fs
    .readdirSync(MESSAGES_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.basename(name, ".json"))
    .filter(Boolean);

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const cleanDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
};

const copyDir = (from, to) => {
  fs.cpSync(from, to, { recursive: true });
};

const runBuild = (locale, defaultLocale) => {
  const shouldForceExport =
    !process.env.VERCEL && !process.env.GITHUB_ACTIONS;
  const env = {
    ...process.env,
    BUILD_LOCALES: locale,
    HTML_LANG_LOCALE: locale,
    NEXT_PUBLIC_DEFAULT_LOCALE: defaultLocale,
    DEFAULT_LOCALE: defaultLocale,
    ...(shouldForceExport ? { VERCEL: "1" } : {}),
  };
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    {
      cwd: ROOT,
      stdio: "inherit",
      env,
    }
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const locales = readLocales();
if (locales.length === 0) {
  console.error("No locale files found in messages/.");
  process.exit(1);
}

const defaultLocale =
  process.env.DEFAULT_LOCALE?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_LOCALE?.trim() ||
  locales[0];

if (!locales.includes(defaultLocale)) {
  console.error(
    `DEFAULT_LOCALE "${defaultLocale}" is not in messages/.`
  );
  process.exit(1);
}

const orderedLocales = [
  defaultLocale,
  ...locales.filter((locale) => locale !== defaultLocale),
];

cleanDir(TEMP_DIR);
ensureDir(TEMP_DIR);
ensureDir(MERGED_DIR);

orderedLocales.forEach((locale) => {
  cleanDir(OUT_DIR);
  runBuild(locale, defaultLocale);
  if (!fs.existsSync(OUT_DIR)) {
    console.error("Build output not found in out/.");
    process.exit(1);
  }
  if (locale === defaultLocale) {
    copyDir(OUT_DIR, MERGED_DIR);
  } else {
    const localeDir = path.join(OUT_DIR, locale);
    if (!fs.existsSync(localeDir)) {
      console.error(`Missing output directory: ${localeDir}`);
      process.exit(1);
    }
    copyDir(localeDir, path.join(MERGED_DIR, locale));
  }
});

cleanDir(OUT_DIR);
fs.renameSync(MERGED_DIR, OUT_DIR);
cleanDir(TEMP_DIR);
