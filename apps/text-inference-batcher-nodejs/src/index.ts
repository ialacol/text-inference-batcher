import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { OpenAIApi, Configuration, type CreateCompletionRequest, CreateChatCompletionRequest } from "openai-edge";
import { parseUpstreams } from "./parseUpstreams.js";
import { updateUpstreamState } from "./updateUpstreamState.js";
import * as state from "./globalState.js";
import { type Upstream } from "./globalState.js";
import { env } from "hono/adapter";
import { waitOrThrow } from "./waitOrThrow.js";
import { getLeastLatency } from "./getLeastLatency.js";

const app = new Hono();
app.use("*", logger(), cors());

app.post("/v1/completions", async (context) => {
  const DEBUG = env<{ DEBUG?: string }>(context)?.DEBUG === "true";

  const urls = parseUpstreams(env<{ UPSTREAMS?: string }>(context)?.UPSTREAMS);
  await updateUpstreamState(urls);
  const completionRequestBody: CreateCompletionRequest = await context.req.json();

  const model = completionRequestBody.model;

  if (state.filterByModel(model).length === 0) {
    const allModels = state.getAllModels().join(",");
    console.error("no upstream found with model \"%s\", all available models: [%s]", model, allModels);
    // https://platform.openai.com/docs/guides/error-codes/api-errors
    throw new HTTPException(422, { message: `No upstream found with ${model}, all available models: ${allModels}.` });
  }
  const { MAX_CONNECT_PER_UPSTREAM, TIMEOUT } = env<{ MAX_CONNECT_PER_UPSTREAM?: string, TIMEOUT?: string }>(context);
  await waitOrThrow(model, MAX_CONNECT_PER_UPSTREAM, TIMEOUT);

  // "least connections"/"least latency" load balancing
  const selectedUpstream = state.getLeastConnection(model).reduce(getLeastLatency);
  console.info("selected upstream: %s for model: %s", selectedUpstream.url.href, model);

  const { signal, abort } = new AbortController();
  return new Response(new ReadableStream({
    async start (controller) {
      try {
        const configuration = new Configuration({
          basePath: `${selectedUpstream.url.href}v1`,
          apiKey: context.req.header("OPENAI_API_KEY")
        });
        const openai = new OpenAIApi(configuration);
        const index = state.findIndex(({ id }) => id === selectedUpstream.id);
        state.updateByIndex(index, {
          ...selectedUpstream,
          last: new Date(),
          used: selectedUpstream.used + 1,
          connections: selectedUpstream.connections + 1
        });
        if (DEBUG) {
          // log the upstream state before the request
          console.table(state.findByIndex(index));
        }
        const { body } = await openai.createCompletion(completionRequestBody, { signal });
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
      // reduce the number of connections
      const index = state.findIndex(({ id }) => id === selectedUpstream.id);
      const before = state.findByIndex(index) as Upstream;
      state.updateByIndex(index, {
        ...before,
        connections: before.connections - 1
      });
      if (DEBUG) {
        // log the upstream state after the request
        console.table(state.findByIndex(index));
      }
    },
    cancel () {
      // This is called if the downstream cancels,
      // so we should stop the `openai.createCompletion` request to the upstream
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

app.post("/v1/chat/completions", async (context) => {
  const DEBUG = env<{ DEBUG?: string }>(context)?.DEBUG === "true";

  const urls = parseUpstreams(env<{ UPSTREAMS?: string }>(context)?.UPSTREAMS);
  await updateUpstreamState(urls);
  const chatCompletionRequestBody: CreateChatCompletionRequest = await context.req.json();

  const model = chatCompletionRequestBody.model;

  if (state.filterByModel(model).length === 0) {
    const allModels = state.getAllModels().join(",");
    console.error("no upstream found with model \"%s\", all available models: [%s]", model, allModels);
    // https://platform.openai.com/docs/guides/error-codes/api-errors
    throw new HTTPException(422, { message: `No upstream found with ${model}, all available models: ${allModels}.` });
  }
  const { MAX_CONNECT_PER_UPSTREAM, TIMEOUT } = env<{ MAX_CONNECT_PER_UPSTREAM?: string, TIMEOUT?: string }>(context);
  await waitOrThrow(model, MAX_CONNECT_PER_UPSTREAM, TIMEOUT);

  // "least connections"/"least latency" load balancing
  const selectedUpstream = state.getLeastConnection(model).reduce(getLeastLatency);
  console.info("selected upstream: %s for model: %s", selectedUpstream.url.href, model);

  const { signal, abort } = new AbortController();

  return new Response(new ReadableStream({
    async start (controller) {
      try {
        const configuration = new Configuration({
          basePath: `${selectedUpstream.url.href}v1`,
          apiKey: context.req.header("OPENAI_API_KEY")
        });
        const openai = new OpenAIApi(configuration);
        const index = state.findIndex(({ id }) => id === selectedUpstream.id);
        state.updateByIndex(index, {
          ...selectedUpstream,
          last: new Date(),
          used: selectedUpstream.used + 1,
          connections: selectedUpstream.connections + 1
        });
        if (DEBUG) {
          // log the upstream state before the request
          console.table(state.findByIndex(index));
        }
        const { body } = await openai.createChatCompletion(chatCompletionRequestBody, { signal });
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
      // reduce the number of connections
      const index = state.findIndex(({ id }) => id === selectedUpstream.id);
      const before = state.findByIndex(index) as Upstream;
      state.updateByIndex(index, {
        ...before,
        connections: before.connections - 1
      });
      if (DEBUG) {
        // log the upstream state after the request
        console.table(state.findByIndex(index));
      }
    },
    cancel () {
      // This is called if the downstream cancels,
      // so we should stop the `openai.createCompletion` request to the upstream
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

console.log("listening on http://localhost:8000");

if (process.env.UPSTREAMS) {
  const urls = parseUpstreams(process.env.UPSTREAMS);
  updateUpstreamState(urls).catch((error) => {
    console.error(error);
  });
}

const signals: Record<string, number> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15
};

const shutdown = (signal: string, value: number) => {
  console.log(`server stopped by ${signal} with value ${value}`);
  process.exit(128 + value);
};

Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.log(`process received a ${signal} signal`);
    shutdown(signal, signals[signal]);
  });
});
