import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/mktemp/index.ts"],
  exports: true,
  dts: true,
  format: ["esm", "cjs"],
});
