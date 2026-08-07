import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const maximumNonblankLines = 400;
const excludedDirectories = new Set([".git", ".next", "node_modules"]);
const excludedFiles = new Set(["package-lock.json"]);
const excludedPathPrefixes = ["prisma/generated/"];
const textExtensions = new Set([
  ".cjs", ".css", ".js", ".json", ".mjs", ".md", ".prisma", ".ts", ".tsx", ".yml", ".yaml",
]);

async function authoredFiles(directory = ".") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : authoredFiles(path);
    const projectPath = relative(".", path);
    if (excludedFiles.has(entry.name) || excludedPathPrefixes.some(prefix => projectPath.startsWith(prefix))) return [];
    return textExtensions.has(extname(entry.name)) ? [projectPath] : [];
  }));
  return files.flat();
}

const violations = [];
for (const path of await authoredFiles()) {
  const content = await readFile(path, "utf8");
  const count = content.split(/\r?\n/).filter(line => line.trim()).length;
  if (count > maximumNonblankLines) violations.push({ path, count });
}

if (violations.length) {
  console.error(`Authored files must contain at most ${maximumNonblankLines} nonblank lines:`);
  for (const violation of violations) console.error(`- ${violation.path}: ${violation.count}`);
  process.exitCode = 1;
}
