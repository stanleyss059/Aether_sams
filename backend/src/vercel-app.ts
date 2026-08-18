import { createApp } from "./create-app.js";

const app = createApp();
export default app;
export const config = { api: { bodyParser: false as const } };
