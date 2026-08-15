import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`StudyForge API listening on port ${config.port}`);
});

process.on("SIGINT", async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});
