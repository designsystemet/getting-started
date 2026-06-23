import { defineConfig } from "tsdown";

export default defineConfig({
  // Single barrel entry that re-exports every component's class map.
  entry: ["src/index.ts"],

  // Ship modern ESM + type declarations. The published `index.d.mts` is
  // self-contained (the barrel re-exports each `*.module.css` default as a
  // typed const), so consumers never need an ambient declaration of their own.
  format: ["esm"],
  dts: true,
  clean: true,
  platform: "neutral",
  exports: true,

  // `@tsdown/css` (powered by rolldown + Lightning CSS) handles every imported
  // `*.css` file. `.module.css` files are compiled as CSS Modules: class names
  // are scoped, the JS import resolves to a `{ local: scoped }` map, and the
  // generated CSS is extracted into a single `dist/style.css`.
  css: {
    // Set to `true` to ship pre-minified CSS; left readable so consumers can
    // minify as part of their own pipeline.
    minify: false,
    modules: {
      // Scoped class pattern (Lightning CSS tokens). `[local]` keeps the
      // authored name for debugging; `[hash]` guarantees uniqueness across the
      // published bundle.
      generateScopedName: "myds_[hash]_[local]",
    },
  },
});
