import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/vercel-app.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "src/app.cjs",
  // Prisma's query engine cannot be bundled. Everything else is inlined so the
  // Vercel function does not need node_modules for zod/express/etc.
  external: ["@prisma/client", "prisma"],
  banner: {
    js: "const require_import_meta_url = require('node:url').pathToFileURL(__filename).href;",
  },
  footer: {
    js: "module.exports = vercel_app_default;",
  },
  define: {
    "import.meta.url": "require_import_meta_url",
  },
});
