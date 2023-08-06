import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { OpenAIApi, Configuration, type CreateCompletionRequest } from "openai-edge";
import { parseUpstreamUrls } from "./parseUpstreamUrls";
import { updateUpstreamState } from "./updateUpstreamState";
import { filterByModel, getLeastConnection, findIndex, updateByIndex, findByIndex, type Upstream, getAllModels } from "./globalState";
import { env } from "hono/adapter";

const app = new Hono();
app.use("*", logger(), cors());

app.post("/v1/completions", async (context) => {
  await updateUpstreamState(parseUpstreamUrls(context));
  const completionRequestBody: CreateCompletionRequest = await context.req.json();

  if (filterByModel(completionRequestBody.model).length === 0) {
    // https://platform.openai.com/docs/guides/error-codes/api-errors
    throw new HTTPException(503, { message: `No upstream found with ${completionRequestBody.model}, all available models: ${getAllModels().join(",")}.` });
  }
  const { MAX_CONNECT_PER_UPSTREAM, TIMEOUT } = env<{ MAX_CONNECT_PER_UPSTREAM?: string, TIMEOUT: string }>(context);
  const maxConnection = parseInt(MAX_CONNECT_PER_UPSTREAM ?? "1");
  // timeout in milliseconds, default to 10 minutes
  const timeout = parseInt(TIMEOUT ?? "600000");
  let waiting = 0;
  // keep waiting if there is no free (connections < MAX_CONNECT_PER_UPSTREAM) upstream with the matching model
  while (
    filterByModel(completionRequestBody.model)
      .filter(({ connections }) => connections < maxConnection).length === 0
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    waiting += 1000;
    if (waiting >= timeout) {
      throw new HTTPException(503, { message: "Timeout waiting for a free upstream, try again later" });
    }
  }

  // "least connections" load balancing
  const leastConnectionUpstream = getLeastConnection(completionRequestBody.model);

  // select the way with the least latency
  const selectedUpstream = leastConnectionUpstream.reduce((accumulator, currentValue) => {
    if (currentValue.latency < accumulator.latency) {
      return currentValue;
    }
    return accumulator;
  });

  const { signal, abort } = new AbortController();
  return new Response(new ReadableStream({
    async start (controller) {
      try {
        const apiKeyHeader = context.req.header("OPENAI_API_KEY");
        const configuration = new Configuration({
          basePath: `${selectedUpstream.url.href}/v1`,
          apiKey: apiKeyHeader
        });
        const openai = new OpenAIApi(configuration);
        const index = findIndex(({ id }) => id === selectedUpstream.id);
        updateByIndex(index, {
          ...selectedUpstream,
          last: new Date(),
          used: selectedUpstream.used + 1,
          connections: selectedUpstream.connections + 1
        });
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
      const index = findIndex(({ id }) => id === selectedUpstream.id);
      const before = findByIndex(index) as Upstream;
      updateByIndex(index, {
        ...before,
        connections: before.connections - 1
      });
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
