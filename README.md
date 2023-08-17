# Text Inference Batcher

`text-inference-batcher` is a high-performance router optimized for maximum throughput in text inference workload.

## Quick Start

### Run in Container

There is an image host on [ghcr.io](https://github.com/chenhunghan/text-inference-batcher/pkgs/container/text-inference-batcher-nodejs)

```sh
export UPSTREAMS="http://localhost:8080,http://localhost:8081" # List of OpenAI-compatible upstreams separated by comma
docker run --rm -it -p 8000:8000 -e UPSTREAMS=$UPSTREAMS ghcr.io/chenhunghan/text-inference-batcher-nodejs:latest # node.js version
```

### Kubernetes

`text-inference-batcher` offers first class support for Kubernetes.

Quickly deploy two inference backend using [ialacol](https://github.com/chenhunghan/ialacol) in namespace `llm`.

```sh
helm repo add ialacol https://chenhunghan.github.io/ialacol
helm repo update
# the classic llama-2 13B
helm install llama-2 ialacol/ialacol \ 
  --set deployment.env.DEFAULT_MODEL_HG_REPO_ID="" \
  --set deployment.env.DEFAULT_MODEL_FILE="llama-2-13b-chat.ggmlv3.q4_0.bin" \
  -n llm
# orca mini fine-tuned llama-2 https://huggingface.co/psmathur/orca_mini_v3_13b
helm install orca-mini ialacol/ialacol \
  --set deployment.env.DEFAULT_MODEL_HG_REPO_ID="TheBloke/orca_mini_v3_13B-GGML" \
  --set deployment.env.DEFAULT_MODEL_HG_REPO_ID="orca_mini_v3_13b.ggmlv3.q4_0.bin" \
  -n llm
# just another fine-tuned variant
helm install stable-platypus2 ialacol/ialacol \
  --set deployment.env.DEFAULT_MODEL_HG_REPO_ID="TheBloke/Stable-Platypus2-13B-GGML" \
  --set deployment.env.DEFAULT_MODEL_HG_REPO_ID="stable-platypus2-13b.ggmlv3.q4_0.bin" \
  -n llm
```

Add `text-inference-batcher` pointing to upstreams.

```sh
helm repo add text-inference-batcher <https://chenhunghan.github.io/text-inference-batcher>
helm repo update
helm install tib text-inference-batcher/text-inference-batcher-nodejs \
  --set deployment.env.UPSTREAMS="http://llama-2:8000,http://orca-mini:8000,http://stable-platypus2:8000"
  -n llm
```

Port forward `text-inference-batcher` for testing.

```sh
kubectl port-forward svc/tib 8000:8000 -n llm
```

Single gateway for all your inference backends

```sh
openai -k "sk-" -b http://localhost:8000/v1 -vv api chat_completions.create -m llama-2-13b-chat.ggmlv3.q4_0.bin -g user "Hello world!"
openai -k "sk-" -b http://localhost:8000/v1 -vv api chat_completions.create -m orca_mini_v3_13b.ggmlv3.q4_0.bin -g user "Hello world!"
openai -k "sk-" -b http://localhost:8000/v1 -vv api chat_completions.create -m stable-platypus2-13b.ggmlv3.q4_0.bin -g user "Hello world!"
```

## Features

- Max throughput by queuing, and continuous batching of incoming requests.
- Optimize any backends with OpenAI-compatible API, including:
  - [ialacol](https://github.com/chenhunghan/ialacol)
  - [llama-cpp-python](https://github.com/abetlen/llama-cpp-python/tree/main#web-server)
  - [vllm](https://github.com/vllm-project/vllm)
  - [LocalAI](https://github.com/go-skynet/LocalAI)
  - [FastChat](https://github.com/lm-sys/FastChat/blob/main/docs/openai_api.md)
  - [OpenLLM](https://github.com/bentoml/OpenLLM)
  - [llama-api-server](https://github.com/iaalm/llama-api-server)
  - [simpleAI](https://github.com/lhenault/simpleAI)
- Automatically discovers and indexes all available models from upstreams, routing requests to the appropriate destination. Trying multiple models simultaneously with a single entrypoint!
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

## Configuration

The following environmental variables are available

| Variable                   |  Description                                                     | Default            | Example                                          |
| :------------------------- |  :-------------------------------------------------------------- | :----------------  | :----------------------------------------------- |
| `UPSTREAMS`                |  A list of upstream, separated by comma.                         | `null`             | `http://llama-2:8000,http://falcon:8000`         |
| `MAX_CONNECT_PER_UPSTREAM` |  The max number of connection per upstream                       | `1`                | `666`                                            |
| `WAIT_FOR`                 |  The duration to wait for an upstream to become ready in `ms`    | `5000` (5 secs)    | `30000` (30 seconds)                             |
| `TIMEOUT`                  |  The timeout of connection to upstream in `ms`                   | `600000` (10 mins) | `60000` (1 min)                                  |
| `DEBUG`                    |  Verbose logging                                                 | `false`            | `true`                                           |
| `TIB_PORT`                 |  Listening port                                                  | `8000`             | `8889`                                           |

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

## Development

The repo is a monorepo managed by [Turborepo](https://turbo.build/repo), applications such as nodejs version of `text-inference-batcher` are in `./apps/*`, packages are in `./packages/*`

To install the dependencies

```sh
npm install
```

Start all applications in development mode

```sh
npm run dev
```

### Container Image

```sh
docker build --file ./apps/text-inference-batcher-nodejs/Dockerfile -t tib:latest .
docker run --rm -p 8000:8000 tib:latest
```

Build, run and remove after it exits.

```sh
docker run --rm -it -p 8000:8000 $(docker build --file ./apps/text-inference-batcher-nodejs/Dockerfile -q .)
```
