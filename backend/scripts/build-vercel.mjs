import * as esbuild from "esbuild";

// Keep heavy/runtime-native deps external; bundle zod and the rest so Vercel tracing
// does not omit required modules (see "Cannot find module 'zod'" in function logs).
const external = [
  "@prisma/client",
  "prisma",
  "mammoth",
  "pdf-parse",
  "pdf-parse/lib/pdf-parse.js",
];

await esbuild.build({
  entryPoints: ["src/vercel-app.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "src/app.cjs",
  external,
  banner: {
    js: "const require_import_meta_url = require('node:url').pathToFileURL(__filename).href;",
  },
  footer: {
    js: "module.exports = vercel_app_default; module.exports.maxDuration = 60;",
  },
  define: {
    "import.meta.url": "require_import_meta_url",
  },
});
