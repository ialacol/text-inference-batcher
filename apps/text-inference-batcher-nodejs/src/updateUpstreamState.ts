import { findIndex, spliceOneByIndex, find, push } from "./globalState.js";
import { type ListModelsResponse } from "openai-edge";

export async function updateUpstreamState (urls: Set<URL>) {
  return Promise.allSettled(Array.from(urls).map(async (url) => {
    console.group(`update upstream ${url.href} state`);
    console.time(`updateUpstreamState(${url.href})`);
    const t0 = performance.now();
    console.info(`fetching ${url.href}v1/models`);
    const controller = new AbortController();
    // abort the /models after 5 seconds timeout
    const id = setTimeout(() => controller.abort(), 5000);
    const [result] = await Promise.allSettled([fetch(`${url.href}v1/models`, {
      signal: controller.signal
    })]);
    clearTimeout(id);
    const t1 = performance.now();

    // if fetch rejected, remove the url from the state
    if (result.status === "rejected") {
      console.warn(`fetching ${url.href}v1/models failed, removing from upstreams`);
      spliceOneByIndex(findIndex(({ url: { href } }) => href === url.href));
    }
    if (result.status === "fulfilled") {
      // if upstream returns something else than 2xx, remove the url from the state
      if (!result.value.ok) {
        console.warn(`fetching ${url.href}v1/models get ${result.value.status}/${result.value.statusText}, removing from upstreams`);
        spliceOneByIndex(findIndex(({ url: { href } }) => href === url.href));
      }
      const response = result.value;
      const models: ListModelsResponse = await response.json();
      for (const model of models.data) {
        const modelId = model.id;
        const found = find(({ url: { href }, model }) => href === url.href && model === modelId);
        if (!found) {
          console.info(`model.id ${model.id} from ${url.href} not found, adding to upstream list`);
          const upstream = {
            id: crypto.randomUUID(),
            url,
            // the bin filename if the upstream is ialacol
            model: model.id,
            latency: t1 - t0,
            // never used before, therefore null
            last: null,
            connections: 0,
            used: 0
          };
          push(upstream);
          console.table(upstream);
        }
      }
    }
    console.timeEnd(`updateUpstreamState(${url.href})`);
    console.groupEnd();
  }));
}
