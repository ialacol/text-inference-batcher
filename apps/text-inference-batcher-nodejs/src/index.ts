import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { app } from "./app.js";
import { parseUpstreams } from "./parseUpstreams.js";
import { updateUpstreamState } from "./updateUpstreamState.js";

app.use("*", logger(), cors());

const port = parseInt(process.env.TIB_PORT ?? "8000");
serve({
  fetch: app.fetch,
  port,
});

console.info(`\ntib is listening on http://localhost:${port}`);
console.table({
  UPSTREAMS: process.env.UPSTREAMS,
  MAX_CONNECT_PER_UPSTREAM: process.env.MAX_CONNECT_PER_UPSTREAM,
  WAIT_FOR: process.env.WAIT_FOR,
  TIMEOUT: process.env.TIMEOUT,
  DEBUG: process.env.DEBUG,
  TIB_PORT: process.env.TIB_PORT,
});

if (process.env.UPSTREAMS) {
  const urls = parseUpstreams(process.env.UPSTREAMS);
  updateUpstreamState(urls).catch((error) => {
    console.error(error);
  });
}

const signals: Record<string, number> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15,
};

const shutdown = (signal: string, value: number) => {
  console.warn(`server stopped by ${signal} with value ${value}`);
  process.exit(128 + value);
};

Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.warn(`process received a ${signal} signal`);
    shutdown(signal, signals[signal]);
  });
});
