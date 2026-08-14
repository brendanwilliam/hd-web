import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const maximumNonblankLines = 800;
const maximumCodeColumns = 90;
const excludedDirectories = new Set([".git", ".next", "node_modules"]);
const excludedFiles = new Set(["package-lock.json"]);
const excludedPathPrefixes = ["prisma/generated/"];
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".mjs",
  ".md",
  ".prisma",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);
const codeExtensions = new Set([".cjs", ".css", ".js", ".mjs", ".ts", ".tsx"]);

async function authoredFiles(directory = ".") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return excludedDirectories.has(entry.name) ? [] : authoredFiles(path);
      }

      const projectPath = relative(".", path);
      if (
        excludedFiles.has(entry.name) ||
        excludedPathPrefixes.some((prefix) => projectPath.startsWith(prefix))
      ) {
        return [];
      }

      return textExtensions.has(extname(entry.name)) ? [projectPath] : [];
    }),
  );
  return files.flat();
}

const violations = [];
for (const path of await authoredFiles()) {
  const content = await readFile(path, "utf8");
  const count = content.split(/\r?\n/).filter((line) => line.trim()).length;
  if (count > maximumNonblankLines) {
    violations.push({ path, count });
  }

  if (codeExtensions.has(extname(path))) {
    content.split(/\r?\n/).forEach((line, index) => {
      if (line.length > maximumCodeColumns) {
        violations.push({
          path: `${path}:${index + 1}`,
          count: line.length,
          columns: true,
        });
      }
    });
  }
}

if (violations.length) {
  console.error(
    `Authored files must contain at most ${maximumNonblankLines} nonblank lines ` +
      `and code at most ${maximumCodeColumns} columns:`,
  );

  for (const violation of violations) {
    const unit = violation.columns ? "columns" : "nonblank lines";
    console.error(`- ${violation.path}: ${violation.count} ${unit}`);
  }

  process.exitCode = 1;
}
