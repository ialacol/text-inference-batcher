# Text Inference Batcher

`text-inference-batcher` is a high-performance router optimized for maximum throughput in text inference workload.

## Features

- Max throughput by queuing, and continuous batching of incoming requests.
- Compatible with any OpenAI-compatible RESTful API servers, including:
  - [ialacol](https://github.com/chenhunghan/ialacol)
  - [llama-cpp-python](https://github.com/abetlen/llama-cpp-python/tree/main#web-server)
  - [vllm](https://github.com/vllm-project/vllm)
  - [LocalAI](https://github.com/go-skynet/LocalAI)
  - [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
  - [OpenLLM](https://github.com/bentoml/OpenLLM)
  - [llama-api-server](https://github.com/iaalm/llama-api-server)
  - [simpleAI](https://github.com/lhenault/simpleAI)
- Automatically discovers and indexes all available models from upstream backends, routing requests to the appropriate destination. Trying multiple models simultaneously with a single endpoint!
- Transparent operation, optimizing only for throughput without modifying or altering requests. No intermediate components to debug.
- Edge-first design, compatible with Node.js, Cloudflare Workers, Fastly Compute@Edge, Deno, Bun, Lagon, and AWS Lambda.
- Lightweight with minimal dependencies, including [hono](https://github.com/honojs/hono) and [openai-edge](https://github.com/dan-kwiat/openai-edge).
- Designed with streaming in mind, providing a great user experience.

## Rationale

**Continuous batching** is a simple yet powerful technique to improve the throughput of text inference endpoints ([ref](https://github.com/huggingface/text-generation-inference/tree/main/router#continuous-batching)). Maximizing "throughput" essentially means serving the maximum number of clients simultaneously. Batching involves queuing incoming requests and distributing them to a group of inference servers when they become available.

While there are existing projects that implement batching for inference, such as [Triton](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/examples/jetson/concurrency_and_dynamic_batching/README.html), huggingface's [text-generation-inference](https://github.com/huggingface/text-generation-inference/tree/main/router), and vllm's [AsyncLLMEngine](https://github.com/vllm-project/vllm/blob/main/vllm/engine/async_llm_engine.py#L17C7-L17C21), there is currently no language-agnostic solution available.

`text-inference-batcher` aims to make batching more accessible and language-agnostic by leveraging the generic web standard, the HTTP interface. It brings simple yet powerful batching algorithms to any inference servers with an OpenAI Compatible API. The inference server, which handles the heavy lifting, can be written in any language and deployed on any infrastructure, as long as it exposes OpenAI-compatible endpoints to `text-inference-batcher`.

In addition to high throughput, as a router and load balancer in front of all the inference servers, `text-inference-batcher` offers additional features, including:

- Automatic routing to inference servers with available models, allowing for testing of multiple models simultaneously.
- Metrics for measuring the latency of inference servers.

`text-inference-batcher` itself is written in TypeScript with an edge-first design. It can be deployed on Node.js, Cloudflare Workers, Fastly Compute@Edge, Deno, Bun, Lagon, and AWS Lambda.

## Terminology

### Downstream

We are using the same definition of `downstream` from [envoy](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/intro/terminology) or [nginx](https://stackoverflow.com/questions/32364579/upstream-downstream-terminology-used-backwards-e-g-nginx). That is, a `downstream` host connects to `text-inference-batcher`, sends requests, and receives responses. For example, a Python app using OpenAI Python library to send requests to `text-inference-batcher` is a downstream.

### Upstream

We are using the same definition of `upstream` from [envoy](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/intro/terminology) or [nginx](https://nginx.org/en/docs/http/ngx_http_upstream_module.html). That is, an `upstream` host receives connections and requests from `text-inference-batcher` and returns responses. An OpenAI API compatible API server, for example [ialacol](https://github.com/chenhunghan/ialacol) is a `upstream`.

## Batching Algorithm

In short, `text-inference-batcher` is asynchronous by default. It finds a free and healthy inference server to process requests or queues the request when all inference servers are busy. The queue is consumed when a free inference server becomes available.

- If all upstream backends are healthy and no work is in progress, the algorithm uses "least connection" to send the request with the least number of requests processed.
- Inference is typically a resource-intensive task for an inference server. We assume that one inference server can only process one request at a time (configurable through environmental variables and inference server configuration). When an inference server starts processing a request, it is immediately marked as busy. The batcher then selects the next available inference server using "least connection" or queues the incoming request to wait for the busy inference server to finish processing.
- When an inference server returns a response or the streaming stops, it is marked as available immediately.
- An unhealthy inference server is defined as:
  - The inference server returns a 503 status code when querying the endpoint `GET /models`, indicating that all the models are unavailable on that inference server.
  - The inference server returns a 5xx status code for requests sent to any other endpoint than `GET /models`. For example, if a request is sent to a inference server's `POST /completion` and the server returns a 500 status code, the upstream will be marked as unhealthy immediately and wait for the next round of health checks by the batcher.
- How the batcher behaves with an unhealthy upstream:
  - The batcher continuously checks the healthiness of all inference servers (regardless of their health status) at a 10
