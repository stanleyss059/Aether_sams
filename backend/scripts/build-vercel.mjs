import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(root, "..");
const vendorDir = path.join(backendRoot, "src", "vercel-vendor");
const pdfParseEntry = path.join(backendRoot, "node_modules", "pdf-parse", "lib", "pdf-parse.js");
const pptEntry = path.join(backendRoot, "node_modules", "ppt-to-text", "ppt.js");

fs.rmSync(vendorDir, { recursive: true, force: true });

if (!fs.existsSync(pdfParseEntry)) {
  throw new Error("pdf-parse is not installed. Run npm install in backend/.");
}

await esbuild.build({
  entryPoints: [path.join(backendRoot, "src", "vercel-app.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(backendRoot, "src", "app.cjs"),
  external: ["@prisma/client", "prisma"],
  alias: {
    "pdf-parse": pdfParseEntry,
    "ppt-to-text": pptEntry,
  },
  plugins: [
    {
      name: "unsplit-sheetjs-requires",
      setup(build) {
        build.onLoad({ filter: /[\\/]ppt-to-text[\\/]ppt\.js$/ }, async (args) => ({
          contents: (await fs.promises.readFile(args.path, "utf8"))
            .replace(/require\('cf'\+'b'\)/g, "require('cfb')")
            .replace(/require\('code'\+'page'\)/g, "require('codepage')"),
          loader: "js",
        }));
      },
    },
  ],
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
