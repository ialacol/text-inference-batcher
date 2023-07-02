import { serve } from "@hono/node-server";
import { type Context, Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { env } from "hono/adapter";
import { OpenAIApi } from "openai-edge";
import { type ModelResponse } from "./types";

const downstreamServerState = new Set<{
  /** the full href of the server including protocol without pathname, e.g. http://llama.svc.default.svc.cluster.local */
  href: string
  /** the model that the server have */
  model: string
}>();

async function updateDownstreamServerState (context: Context): Promise<void> {
  const { DOWNSTREAM_SEVERS } = env<{ DOWNSTREAM_SEVERS?: string }>(context);
  if (DOWNSTREAM_SEVERS === undefined) {
    throw new Error("DOWNSTREAM_SEVERS is not defined");
  }
  const downstreamServers = JSON.parse(DOWNSTREAM_SEVERS);
  if (!isArray<string>(downstreamServers)) {
    throw new Error("DOWNSTREAM_SEVERS is not an array");
  }
  if (isArray<string>(downstreamServers)) {
    // not using Promise.all as we want to fail fast
    for (const server of downstreamServers) {
      let serverUrl: URL;
      try {
        serverUrl = new URL(server);
      } catch (error) {
        // URL constructor throws if the URL is invalid
        // https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
        throw new Error(`${server} is not a valid URL`, { cause: error });
      }
      const serverHref = serverUrl.href;

      const modelResponse = await fetch(`${serverHref}/v1/models`);
      const modelResponseJson: ModelResponse = await modelResponse.json();
      for (const model of modelResponseJson.data) {
        downstreamServerState.add({
          href: serverHref,
          model: model.id
        });
      }
    }
  }
}

const app = new Hono();
app.use("*", logger(), cors());

const isArray = <T> (value: unknown): value is T[] => {
  return Array.isArray(value);
};
app.post("/v1/completions", async (context) => {
  await updateDownstreamServerState(context);
  const openai = new OpenAIApi();
  const { signal, abort } = new AbortController();
  return new Response(new ReadableStream({
    async start (controller) {
      try {
        const { body } = await openai.createCompletion({
          model: "gpt-3.5-turbo",
          prompt: "Once upon a time",
          max_tokens: 7,
          temperature: 0,
          stream: true
        }, { signal });
        if (body === null) {
          controller.close();
        } else {
          // Needs this to work around that ts thinks that ReadableStream is not an AsyncGenerator
          // https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62651
          for await (const chunk of body as unknown as AsyncGenerator<Uint8Array>) {
            controller.enqueue(chunk);
          }
          controller.close();
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel () {
      // This is called if the reader cancels,
      // so we should stop the request
      abort();
    }
  }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    }
  });
});

serve({
  fetch: app.fetch,
  port: 8000
});
