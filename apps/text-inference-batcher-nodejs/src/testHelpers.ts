import { type Upstream } from "./globalState.js";
import crypto from "crypto";
import http from "http";

export function getRandomUpstream(override: Partial<Upstream> = {}): Upstream {
  const port = crypto.randomInt(3000, 9999);
  const upstream: Upstream = {
    id: crypto.randomUUID(),
    url: new URL(`http://localhost:${port}`),
    model: crypto.randomBytes(8).toString("hex"),
    latency: 100,
    last: new Date(),
    connections: crypto.randomInt(66),
    used: crypto.randomInt(66),
  };
  return { ...upstream, ...override };
}

export const startServer = (server: http.Server, port: number, hostname: string) => {
  return new Promise((resolve, reject) => {
    server.listen(port, hostname, () => {
      resolve(server);
    });
    server.on("error", reject);
  });
};
