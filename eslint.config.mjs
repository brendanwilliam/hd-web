import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});
const config = [...compat.extends("next/core-web-vitals")];
const ignoredFiles = [{ ignores: [".next/**"] }];
const readabilityRules = {
  rules: {
    "max-len": [
      "error",
      {
        code: 90,
        tabWidth: 2,
        ignoreUrls: false,
        ignoreStrings: false,
        ignoreTemplateLiterals: false,
        ignoreComments: false,
      },
    ],
  },
};
const eslintConfig = [...ignoredFiles, ...config, readabilityRules];
export default eslintConfig;
