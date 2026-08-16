import { createApp } from "./app.js";

const app = createApp();
export default app;

if (!process.env.VERCEL) {
  void import("./config.js").then(({ config, configError }) => {
    if (!config) {
      console.error(`Invalid StudyForge environment: ${configError}`);
      process.exit(1);
    }
    app.listen(config.port, () => {
      console.log(`StudyForge API listening on port ${config.port}`);
    });
  });
}
