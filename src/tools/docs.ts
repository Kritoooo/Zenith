import "server-only";

import { readFile } from "fs/promises";
import path from "path";

const BASE_DOC_FILES = ["docs.md", "README.md"] as const;

const getDocCandidates = (locale?: string) => {
  if (!locale) return BASE_DOC_FILES;
  return [
    `docs.${locale}.md`,
    `README.${locale}.md`,
    ...BASE_DOC_FILES,
  ];
};

export async function getToolDocs(
  slug: string,
  locale?: string
): Promise<string | null> {
  for (const filename of getDocCandidates(locale)) {
    const filePath = path.join(process.cwd(), "src", "tools", slug, filename);
    try {
      const contents = await readFile(filePath, "utf8");
      if (contents.trim()) {
        return contents;
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  return null;
}
