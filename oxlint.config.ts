import { defineConfig } from "@gameroman/config/oxlint/typeaware";

export default defineConfig({
  ignorePatterns: ["tests"],

  rules: {
    "no-floating-promises": "off",
    "restrict-template-expressions": "off",
    "no-unnecessary-condition": "off",
  },
});
