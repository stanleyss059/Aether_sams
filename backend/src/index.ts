import express, { type RequestHandler } from "express";

// Nothing heavy is imported at module scope. Vercel discards a function whose
// module graph throws during load, which surfaces as FUNCTION_INVOCATION_FAILED
// with no usable detail, so the real app is loaded on the first request and any
// failure is reported as JSON instead.
const app = express();
let pending: Promise<RequestHandler> | null = null;

function loadApp(): Promise<RequestHandler> {
  if (!pending) {
    pending = import("./app.js")
      .then((module) => module.createApp() as unknown as RequestHandler)
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

app.use((req, res, next) => {
  loadApp().then(
    (real) => real(req, res, next),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("StudyForge failed to start:", error);
      res.status(500).json({
        success: false,
        error: {
          message: `StudyForge failed to start: ${message}`,
          code: "BOOTSTRAP",
          trace: req.query.trace === "1" && error instanceof Error ? error.stack?.split("\n").slice(0, 8) : undefined,
        },
      });
    },
  );
});

export default app;

if (!process.env.VERCEL) {
  void (async () => {
    const { config, configError } = await import("./config.js");
    if (!config) {
      console.error(`Invalid StudyForge environment: ${configError}`);
      process.exit(1);
    }
    app.listen(config.port, () => {
      console.log(`StudyForge API listening on port ${config.port}`);
    });
  })();
}
