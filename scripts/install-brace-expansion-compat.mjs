import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const expectedVersion = "5.0.8";
const packagePath = require.resolve("brace-expansion/package.json");
const packageDirectory = path.dirname(packagePath);
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

assert.equal(
  packageJson.version,
  expectedVersion,
  `Expected brace-expansion ${expectedVersion}, received ${packageJson.version}`,
);

// minimatch 3 and 9 call the CommonJS export directly. Version 5 exposes a
// named function, so preserve the legacy entry point while using its fix.
const wrapperPath = path.join(packageDirectory, "compat.cjs");
const wrapperSource = `const api = require("./dist/commonjs/index.js");

module.exports = Object.assign(api.expand, api);
`;

await writeFile(wrapperPath, wrapperSource, "utf8");

packageJson.main = "./compat.cjs";
packageJson.exports["."].require.default = "./compat.cjs";

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
