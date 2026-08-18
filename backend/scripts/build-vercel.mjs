import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(root, "..");
const vendorDir = path.join(backendRoot, "src", "vercel-vendor");
const runtimeDeps = ["pdf-parse", "mammoth"];

// Keep heavy parsers out of app.cjs; copy them beside the function entry instead.
fs.rmSync(vendorDir, { recursive: true, force: true });
fs.mkdirSync(vendorDir, { recursive: true });
for (const dep of runtimeDeps) {
  fs.cpSync(path.join(backendRoot, "node_modules", dep), path.join(vendorDir, dep), { recursive: true });
}

// Bundle app code; externalize prisma + the copied parser packages.
const external = ["@prisma/client", "prisma", ...runtimeDeps];

await esbuild.build({
  entryPoints: [path.join(backendRoot, "src", "vercel-app.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(backendRoot, "src", "app.cjs"),
  external,
  banner: {
    js: "const require_import_meta_url = require('node:url').pathToFileURL(__filename).href;",
  },
  footer: {
    js: "module.exports = vercel_app_default; module.exports.maxDuration = 60; module.exports.config = { api: { bodyParser: false } };",
  },
  define: {
    "import.meta.url": "require_import_meta_url",
  },
});
