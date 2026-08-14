import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(repositoryRoot, "server/content/feedback-mind-v2-9-definitions.md");
const outputPath = resolve(repositoryRoot, "server/content/product-definitions.generated.ts");
const markdown = readFileSync(sourcePath, "utf8");

writeFileSync(
  outputPath,
  `// Generated from feedback-mind-v2-9-definitions.md. Do not edit directly.\nexport const productDefinitionsMarkdown = ${JSON.stringify(markdown)};\n`,
  "utf8",
);
