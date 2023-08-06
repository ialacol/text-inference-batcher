import { findIndex, spliceOneByIndex, find, push } from "./globalState";
import { type ListModelsResponse } from "openai-edge";

export async function updateUpstreamState (urls: Set<URL>) {
  return Promise.allSettled(Array.from(urls).map(async (url) => {
    const t0 = performance.now();
    const [result] = await Promise.allSettled([fetch(`${url.href}/v1/models`)]);
    const t1 = performance.now();

    // if fetch rejected, remove the url from the state
    if (result.status === "rejected") {
      spliceOneByIndex(findIndex(({ url: { href } }) => href === url.href));
    }
    if (result.status === "fulfilled") {
      // if upstream returns something else than 2xx, remove the url from the state
      if (!result.value.ok) {
        spliceOneByIndex(findIndex(({ url: { href } }) => href === url.href));
        return;
      }
      const response = result.value;
      const models: ListModelsResponse = await response.json();
      for (const model of models.data) {
        const modelId = model.id;
        const found = find(({ url: { href }, model }) => href === url.href && model === modelId);
        if (!found) {
          push({
            id: crypto.randomUUID(),
            url,
            // the bin filename if the upstream is ialacol
            model: model.id,
            latency: t1 - t0,
            // never used before, therefore null
            last: null,
            connections: 0,
            used: 0
          });
        }
      }
    }
  }));
}
