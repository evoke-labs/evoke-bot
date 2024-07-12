import { Server, Probot } from "probot";
import 'dotenv/config'

import app from "./index";

async function startServer() {
  const server = new Server({
    Probot: Probot.defaults({
      appId: process.env.APP_ID,
      privateKey: process.env.PRIVATE_KEY,
      secret: process.env.WEBHOOK_SECRET
    }),
    webhookProxy: process.env.WEBHOOK_PROXY_URL
  });

  await server.load(app);

  await server.start();
}

startServer()
