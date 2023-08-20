import { type Upstream } from "./globalState.js";
import crypto from "crypto";
import http from "http";
import { OpenAI } from "openai";

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

export const createServer = ({
  modelId,
  listModelLatency,
  completionsLatency,
  chatCompletionsLatency,
}: {
  modelId: string;
  listModelLatency: number;
  completionsLatency: number;
  chatCompletionsLatency: number;
}) => {
  const server = http.createServer((req, res) => {
    if (req.url === "/v1/models") {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json", "X-Req-Url": req.url });
        res.end(
          JSON.stringify({
            object: "list",
            data: [
              {
                id: modelId,
                object: "model",
                created: new Date().getTime(),
                owned_by: "comunity",
              },
            ],
          } satisfies {
            object: string;
            data: Array<OpenAI.Model>;
          }),
        );
      }, listModelLatency);
    }
    if (req.url === "/v1/chat/completions") {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json", "X-Req-Url": req.url });
        res.end(
          JSON.stringify({
            id: crypto.randomUUID(),
            object: "chat.completion",
            created: new Date().getTime(),
            model: modelId,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: crypto.randomBytes(8).toString("hex"),
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: crypto.randomInt(66),
              completion_tokens: crypto.randomInt(66),
              total_tokens: crypto.randomInt(66),
            },
          } satisfies OpenAI.Chat.Completions.ChatCompletion),
        );
      }, chatCompletionsLatency);
    }

    if (req.url === "/v1/completions") {
      setTimeout(() => {
        console.timeLog("completions");
        res.writeHead(200, { "Content-Type": "application/json", "X-Req-Url": req.url });
        res.end(
          JSON.stringify({
            id: crypto.randomUUID(),
            object: "text_completion",
            created: new Date().getTime(),
            model: modelId,
            choices: [
              {
                text: crypto.randomBytes(8).toString("hex"),
                index: 0,
                logprobs: null,
                finish_reason: "length",
              },
            ],
            usage: {
              prompt_tokens: crypto.randomInt(66),
              completion_tokens: crypto.randomInt(66),
              total_tokens: crypto.randomInt(66),
            },
          } satisfies OpenAI.Completions.Completion),
        );
      }, completionsLatency);
    }
  });
  return server;
};

/**
 * Start a server on a random "safe" port 1025-48657
 */
export const startServer = (server: http.Server): Promise<URL> => {
  const port = crypto.randomInt(1025, 48657);
  const hostname = "localhost";
  const url = new URL(`http://${hostname}:${port}`);
  return new Promise((resolve, reject) => {
    server.listen(port, "localhost", () => {
      resolve(url);
    });
    server.on("error", reject);
  });
};
