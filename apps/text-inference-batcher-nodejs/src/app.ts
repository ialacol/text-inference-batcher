import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type OpenAI } from "openai";
import { parseUpstreams } from "./parseUpstreams.js";
import { updateUpstreamState } from "./updateUpstreamState.js";
import * as state from "./globalState.js";
import { type Upstream } from "./globalState.js";
import { env } from "hono/adapter";
import { waitOrThrow } from "./waitOrThrow.js";
import { leastLatency } from "./leastLatency.js";

const app = new Hono();

app.post("/v1/completions", async (context) => {
  const DEBUG = env<{ DEBUG?: string }>(context)?.DEBUG === "true";

  const completionRequestBody: OpenAI.Completions.CompletionCreateParams = await context.req.json();

  const model = completionRequestBody.model;

  if (state.filterByModel(model).length === 0) {
    const allModels = state.getAllModels().join(",");
    console.error("no upstream found with model %s, all available models: [%s]", model, allModels);
    // https://platform.openai.com/docs/guides/error-codes/api-errors
    throw new HTTPException(422, {
      message: `No upstream found with ${model}, all available models: ${allModels}.`,
    });
  }
  const { MAX_CONNECT_PER_UPSTREAM, TIMEOUT } = env<{
    MAX_CONNECT_PER_UPSTREAM?: string;
    TIMEOUT?: string;
  }>(context);
  await waitOrThrow(model, MAX_CONNECT_PER_UPSTREAM, TIMEOUT);

  // "least connections"/"least latency" load balancing
  const selectedUpstream = state.getLeastConnection(model).reduce(leastLatency);
  console.info("selected upstream: %s for model: %s", selectedUpstream.url.href, model);

  const { signal, abort } = new AbortController();
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const index = state.findIndex(({ id }) => id === selectedUpstream.id);
          state.updateByIndex(index, {
            ...selectedUpstream,
            last: new Date(),
            used: selectedUpstream.used + 1,
            connections: selectedUpstream.connections + 1,
          });
          if (DEBUG) {
            // log the upstream state before the request
            console.table(state.findByIndex(index));
          }
          const { body } = await fetch(`${selectedUpstream.url.href}v1/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${context.req.headers.get("Authorization")}`,
            },
            body: JSON.stringify(completionRequestBody),
            signal,
          });
          // Needs this to work around that ts thinks that ReadableStream is not an AsyncGenerator
          // https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62651
          for await (const chunk of body as unknown as AsyncGenerator<Uint8Array>) {
            controller.enqueue(chunk);
          }
          controller.close();
          const urls = parseUpstreams(env<{ UPSTREAMS?: string }>(context)?.UPSTREAMS);
          await updateUpstreamState(urls);
        } catch (error) {
          controller.error(error);
        }
        // reduce the number of connections
        const index = state.findIndex(({ id }) => id === selectedUpstream.id);
        const before = state.findByIndex(index) as Upstream;
        state.updateByIndex(index, {
          ...before,
          connections: before.connections - 1,
        });
        if (DEBUG) {
          // log the upstream state after the request
          console.table(state.findByIndex(index));
        }
      },
      cancel() {
        console.info("Client closed the connection, aborting the request to the upstream.");
        // This is called if the downstream cancels,
        abort("Client closed the connection.");
        console.info("Request to upstream closed.");
      },
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "Content-Type": completionRequestBody.stream ? "text/event-stream" : "application/json",
        "X-Upstream-Origin": selectedUpstream.url.origin,
      },
    },
  );
});

app.post("/v1/chat/completions", async (context) => {
  const DEBUG = env<{ DEBUG?: string }>(context)?.DEBUG === "true";

  const chatCompletionRequestBody: OpenAI.Chat.CompletionCreateParams = await context.req.json();

  const model = chatCompletionRequestBody.model;

  if (state.filterByModel(model).length === 0) {
    const allModels = state.getAllModels().join(",");
    console.error("no upstream found with model %s, all available models: [%s]", model, allModels);
    // https://platform.openai.com/docs/guides/error-codes/api-errors
    throw new HTTPException(422, {
      message: `No upstream found with ${model}, all available models: ${allModels}.`,
    });
  }
  const { MAX_CONNECT_PER_UPSTREAM, TIMEOUT } = env<{
    MAX_CONNECT_PER_UPSTREAM?: string;
    TIMEOUT?: string;
  }>(context);
  await waitOrThrow(model, MAX_CONNECT_PER_UPSTREAM, TIMEOUT);

  // "least connections"/"least latency" load balancing
  const selectedUpstream = state.getLeastConnection(model).reduce(leastLatency);
  console.info("selected upstream: %s for model: %s", selectedUpstream.url.origin, model);

  const { signal, abort } = new AbortController();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const index = state.findIndex(({ id }) => id === selectedUpstream.id);
          state.updateByIndex(index, {
            ...selectedUpstream,
            last: new Date(),
            used: selectedUpstream.used + 1,
            connections: selectedUpstream.connections + 1,
          });
          if (DEBUG) {
            // log the upstream state before the request
            console.table(state.findByIndex(index));
          }
          const { body } = await fetch(`${selectedUpstream.url.href}v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${context.req.headers.get("Authorization")}`,
            },
            body: JSON.stringify(chatCompletionRequestBody),
            signal,
          });
          // Needs this to work around that ts thinks that ReadableStream is not an AsyncGenerator
          // https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/62651
          for await (const chunk of body as unknown as AsyncGenerator<Uint8Array>) {
            controller.enqueue(chunk);
          }
          controller.close();
          const urls = parseUpstreams(env<{ UPSTREAMS?: string }>(context)?.UPSTREAMS);
          await updateUpstreamState(urls);
        } catch (error) {
          controller.error(error);
        }
        // reduce the number of connections
        const index = state.findIndex(({ id }) => id === selectedUpstream.id);
        const before = state.findByIndex(index) as Upstream;
        state.updateByIndex(index, {
          ...before,
          connections: before.connections - 1,
        });
        if (DEBUG) {
          // log the upstream state after the request
          console.table(state.findByIndex(index));
        }
      },
      cancel() {
        console.info("Client closed the connection, aborting the request to the upstream.");
        // This is called if the downstream cancels,
        abort("Client closed the connection.");
        console.info("Request to upstream closed.");
      },
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "Content-Type": chatCompletionRequestBody.stream ? "text/event-stream" : "application/json",
        "X-Upstream-Origin": selectedUpstream.url.origin,
      },
    },
  );
});

export { app };
