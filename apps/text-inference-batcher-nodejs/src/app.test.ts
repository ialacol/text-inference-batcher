import { beforeEach, afterEach, describe, it, mock } from "node:test";
import http from "http";
import assert from "assert/strict";
import { app } from "./app.js";
import * as state from "./globalState.js";
import { updateUpstreamState } from "./updateUpstreamState.js";
import { parseUpstreams } from "./parseUpstreams.js";
import { createServer, startServer } from "./testHelpers.js";

describe("app", () => {
  const servers: Array<http.Server> = [];
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mock.method(console, "info", () => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mock.method(console, "group", () => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mock.method(console, "time", () => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mock.method(console, "table", () => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mock.method(console, "timeLog", () => {});
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mock.method(console, "timeEnd", () => {});
  });
  afterEach(() => {
    state.reset();
    mock.reset();
    for (const server of servers) {
      server.close();
    }
  });
  it("route /v1/completions to upstream with matching model", async () => {
    const falconServer = createServer({
      modelId: "falcon-chat-7b",
      listModelLatency: 10,
      completionsLatency: 0,
      chatCompletionsLatency: 10,
    });
    const llamaServer = createServer({
      modelId: "llama2-chat-7b",
      listModelLatency: 200,
      completionsLatency: 0,
      chatCompletionsLatency: 0,
    });
    const { origin: falconServerOrigin } = await startServer(falconServer);
    const { origin: llamaServerOrigin } = await startServer(llamaServer);
    // update the global state
    await updateUpstreamState(parseUpstreams(`${falconServerOrigin},${llamaServerOrigin}`));
    servers.push(falconServer, llamaServer);
    const req = new Request("http://localhost/v1/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "llama2-chat-7b",
      }),
    });
    const res = await app.request(req);
    assert.equal(res.status, 200);
    assert.strictEqual(res.headers.get("X-Upstream-Origin"), llamaServerOrigin);
  });
  it("least latency loadbalancing /v1/completions requests to upstream", async () => {
    const fastLlamaServer = createServer({
      modelId: "llama2-chat-7b",
      listModelLatency: 10,
      completionsLatency: 0,
      chatCompletionsLatency: 10,
    });
    const slowLlamaServer = createServer({
      modelId: "llama2-chat-7b",
      listModelLatency: 200,
      completionsLatency: 0,
      chatCompletionsLatency: 0,
    });
    const { origin: fastLlamaServerOrigin } = await startServer(fastLlamaServer);
    const { origin: slowLlamaServerOrigin } = await startServer(slowLlamaServer);
    // update the global state
    await updateUpstreamState(parseUpstreams(`${fastLlamaServerOrigin},${slowLlamaServerOrigin}`));
    servers.push(fastLlamaServer, slowLlamaServer);
    const req = new Request("http://localhost/v1/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "llama2-chat-7b",
      }),
    });
    const res = await app.request(req);
    assert.equal(res.status, 200);
    assert.strictEqual(res.headers.get("X-Upstream-Origin"), fastLlamaServerOrigin);
  });
  it("least connection loadbalancing /v1/completions requests to the upstream", async () => {
    const serverOne = createServer({
      modelId: "llama2-chat-7b",
      listModelLatency: 5,
      completionsLatency: 1200,
      chatCompletionsLatency: 10,
    });
    const serverTwo = createServer({
      modelId: "llama2-chat-7b",
      listModelLatency: 100,
      completionsLatency: 1200,
      chatCompletionsLatency: 0,
    });
    const { origin: serverOneOrigin } = await startServer(serverOne);
    const { origin: serverTwoOrigin } = await startServer(serverTwo);
    // update the global state
    await updateUpstreamState(parseUpstreams(`${serverOneOrigin},${serverTwoOrigin}`));
    servers.push(serverOne, serverTwo);
    const requestOptions = {
      method: "POST",
      body: JSON.stringify({
        model: "llama2-chat-7b",
      }),
    };
    const responses = await Promise.all([
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
    ]);
    // TODO: think of better ways...
    let hitUpstreamOne = 0;
    let hitUpstreamTwo = 0;
    for (const res of responses) {
      assert.equal(res.status, 200);
      if (res.headers.get("X-Upstream-Origin") === serverOneOrigin) {
        hitUpstreamOne++;
      }
      if (res.headers.get("X-Upstream-Origin") === serverTwoOrigin) {
        hitUpstreamTwo++;
      }
    }
    assert.equal(hitUpstreamOne, 3);
    assert.equal(hitUpstreamTwo, 3);
  });
  // TODO: fix this test
  it.skip("distribute connection /v1/completions to the whenever an upstream is ready", async () => {
    const serverOne = createServer({
      modelId: "llama2-chat-7b",
      listModelLatency: 5,
      // simulate the upstream processing the request for extra long time
      completionsLatency: 10000,
      chatCompletionsLatency: 10000,
    });
    const serverTwo = createServer({
      modelId: "llama2-chat-7b",
      listModelLatency: 100,
      completionsLatency: 300,
      chatCompletionsLatency: 0,
    });
    const { origin: serverOneOrigin } = await startServer(serverOne);
    const { origin: serverTwoOrigin } = await startServer(serverTwo);
    // update the global state
    await updateUpstreamState(parseUpstreams(`${serverOneOrigin},${serverTwoOrigin}`));
    servers.push(serverOne, serverTwo);
    const requestOptions = {
      method: "POST",
      body: JSON.stringify({
        model: "llama2-chat-7b",
      }),
    };
    const responses = await Promise.all([
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
      app.request(new Request("http://localhost/v1/completions", requestOptions)),
    ]);
    await Promise.all(responses.map((res) => res.json()));
    let hitUpstreamOne = 0;
    let hitUpstreamTwo = 0;
    for (const res of responses) {
      assert.equal(res.status, 200);
      if (res.headers.get("X-Upstream-Origin") === serverOneOrigin) {
        hitUpstreamOne++;
      }
      if (res.headers.get("X-Upstream-Origin") === serverTwoOrigin) {
        hitUpstreamTwo++;
      }
    }
    assert.equal(hitUpstreamOne, 1);
    assert.equal(hitUpstreamTwo, 5);
  });
});
