import express from "express";

// ESM entry for Vercel Express. A compiled src/index.js is loaded as CommonJS
// by the function bytecode runtime, which crashes on `import`.
const app = express();
let pending = null;

function loadApp() {
  if (!pending) {
    pending = import("./create-app.js")
      .then((module) => module.createApp())
      .catch((error) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

app.use((req, res, next) => {
  loadApp().then(
    (real) => real(req, res, next),
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Aether failed to start:", error);
      res.status(500).json({
        success: false,
        error: {
          message: `Aether failed to start: ${message}`,
          code: "BOOTSTRAP",
        },
      });
    },
  );
});

export default app;
