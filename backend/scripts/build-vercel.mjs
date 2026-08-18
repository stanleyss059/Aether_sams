import * as esbuild from "esbuild";

const external = [
  "@prisma/client",
  "prisma",
  "@supabase/supabase-js",
  "cors",
  "dotenv",
  "express",
  "helmet",
  "mammoth",
  "multer",
  "pdf-parse",
  "pdf-parse/lib/pdf-parse.js",
  "zod",
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
