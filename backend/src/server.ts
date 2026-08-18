import { createApp } from "./create-app.js";
import { config, configError } from "./config.js";

const resolved = config;
if (!resolved) {
  console.error(`Invalid Aether environment: ${configError}`);
  process.exit(1);
}

const app = createApp();
app.listen(resolved.port, () => {
  console.log(`Aether API listening on port ${resolved.port}`);
});

