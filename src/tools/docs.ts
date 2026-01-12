import "server-only";

import { readFile } from "fs/promises";
import path from "path";

const DOC_FILES = ["docs.md", "README.md"] as const;

export async function getToolDocs(slug: string): Promise<string | null> {
  for (const filename of DOC_FILES) {
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
