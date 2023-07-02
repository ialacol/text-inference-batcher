# Text Inference Batcher

`text-inference-batcher` is a high performance router optimize max throughput for text inference streaming.

- High-throughput, queue and continuous batching of incoming request streams.
- Compatible with any inference service with OpenAI compatible RESTful API, including
  - [ialacol](https://github.com/chenhunghan/ialacol)
  - [llama-cpp-python](https://github.com/abetlen/llama-cpp-python/tree/main#web-server)
  - [vllm](https://github.com/vllm-project/vllm)
  - [LocalAI](https://github.com/go-skynet/LocalAI)
  - [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
  - [OpenLLM](https://github.com/bentoml/OpenLLM)
  - [llama-api-server](https://github.com/iaalm/llama-api-server)
  - [simpleAI](https://github.com/lhenault/simpleAI)
- Automatically discover and index all available models from the downstream servers, route the request to the destination. Try many models at the same time!
- Transparent, only optimize throughput, forward the requests _untouched_, no ghosts in the middle to debug.
- Edge first, works on Node.js, Cloudflare Workers, Fastly Compute@Edge, Deno, Bun, Lagon, and AWS Lambda.
- Lightweight and minimist the only dependencies are [hono](https://github.com/honojs/hono) and [openai-edge](https://github.com/dan-kwiat/openai-edge)
- Streaming first, great UX!

## Rationale

**Continuously batching** is a simple yet powerful to improve the throughput of text inference endpoints  ([ref](https://github.com/huggingface/text-generation-inference/tree/main/router#continuous-batching)). Improving "throughput", in essence, is to max the number of clients serving at the same time. "Batching" is to queue the incoming requests, and to distribute the requests to a group of inference servers when they are available.

There are existing projects implement the batching for inference, including [Triton](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/examples/jetson/concurrency_and_dynamic_batching/README.html), huggingface's [text-generation-inference](https://github.com/huggingface/text-generation-inference/tree/main/router) and vllm's [AsyncLLMEngine](https://github.com/vllm-project/vllm/blob/main/vllm/engine/async_llm_engine.py#L17C7-L17C21). However, they is no language agnostic solution.

`text-inference-batcher` aims to make batching more accessable and language agnostic by using the generic Web standard, the HTTP interface. `text-inference-batcher` bries the simple yet powerful batching algorithms to any inference servers with OpenAI Compatible API. The inference server, that does the heavy works, can be written in any language on any infrastructure, as long as the inference server exposes OpenAI compatible endpoints to `text-inference-batcher` .

In additional to high throughput, being a router and a load balancer that is in front of all the inference servers, `text-inference-batcher` add addition features including:

- Automatically routing to inference servers with the model aviable, test many models at the same time!
- Metrics of latency of the follow inference servers.

`text-inference-batcher` itself is written in TypeScript with edge-first in mind, it can be deployed on Node.js, Cloudflare Workers, Fastly Compute@Edge, Deno, Bun, Lagon, and AWS Lambda.

## Batching Algorithm

In short, `text-inference-batcher` is async by default, it finds the free and healthy inference server to process the requests or send the request to queue when all inference servers are busy. The queue is consumed when a free inference server becomes available.

- If all downstream inference servers are healthy and no work in hand, then use "least connection", that is to send the request that has least request processed.
- Inference is normally a heavy task for a inference server, we assume one inference server can only process a request at a time (configurable by environmental variable and by inference server configuration file), if a inference server starts processing a request, the inference server will be marked as busy immediately. The batcher would select the next available inference server  (using again "least connection") or queue the incoming request to wait for the busy inference server to finnish processing a request.
- When a inference server returns a response, or the steaming stopped, the inference server will be marked as available immediately.
- An unhealthy inference server is defined as
  - The inference server is returning 503 when query the endpoint `GET /models`, this interprets as the all the models are unavailable at the give inference server.
  - A inference server returns 5xx status code when requests sent to any other endpoints then  `GET /models`, for example if a request sent to a inference server’s `POST /completion` and the serve returns 500, the downstream will be marked as unhealthy immediately and wait for the next round of healthy checks by the bacther.
- How batcher behaves with an unhealthy downstream:
  - The batcher will continuously check the healthiness of all inference servers (no matter it’s healthy of unhealthy) in a 10 seconds (default but configurable by environmental variable) interval.
  - The batcher will not send a request to an unhealthy inference server but queuing the request until the inference server become heathy or exceed the 3 mins (defaults by configurable by environmental variable) timeout.
