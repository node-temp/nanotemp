import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/mktemp.ts"],
  exports: true,
  dts: true,
  outputOptions: { minifyInternalExports: false },
  format: ["esm", "cjs"],
});
