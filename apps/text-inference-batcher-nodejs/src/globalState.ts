export const upstreamState = new Array<{
  /** the id of the upstream backend */
  id: ReturnType<typeof crypto.randomUUID>
  /** the url of the upstream */
  url: URL
  /** the model that the upstream backend */
  model: string,
  /** the latency of the upstream backend, measured by the duration of GET /v1/models */
  latency: number
  /** the time of last request */
  last: Date | null
  /** the current number of requests in process */
  connections: number
  /** the total number of requests sent to upstream */
  used: number
}>();

export type UpstreamState = typeof upstreamState;

export type Upstream = UpstreamState[number];

/**
 * @returns the upstream(s) filtered by model
 */
export const filterByModel = (model: string): UpstreamState => upstreamState.filter(({ model: upstreamModel }) => upstreamModel === model);

/**
 * Remove an upstream from the state by index, return the deleted in array
 */
export const spliceOneByIndex = (index: number): UpstreamState => upstreamState.splice(index, 1);

/**
 * Push an upstream to the state
 */
export const push = (item: Parameters<UpstreamState["push"]>[0]): number =>
  upstreamState.push(item);

/**
 * Update one by index
 */
export const updateByIndex = (index: number, item: UpstreamState[number]) => {
  upstreamState[index] = item;
};

/**
 * Find an upstream from the state
 */
export const find = (predict: Parameters<UpstreamState["find"]>[0]): UpstreamState[number] | undefined =>
  upstreamState.find(predict);

/**
 * Find by index
 */
export const findByIndex = (index: number): UpstreamState[number] | undefined =>
  upstreamState[index];

/**
 * Find an upstream index from the state
 */
export const findIndex = (predict: Parameters<UpstreamState["findIndex"]>[0]): number =>
  upstreamState.findIndex(predict);

/**
 * Get a list of upstream by "least connections" load balancing algorithm and matching model
 *
 * @returns the upstream(s) filtered by model and with the least connections\
 */
export const getLeastConnection = (model: string): UpstreamState => {
  const filtered = filterByModel(model);
  const leastConnection = filtered.reduce((accumulator, currentValue) => {
    if (accumulator.every(({ connections }) => connections > currentValue.connections)) {
      return [currentValue];
    }
    if (accumulator.every(({ connections }) => connections === currentValue.connections)) {
      accumulator.push(currentValue);
    }
    if (accumulator.some(({ connections }) => connections < currentValue.connections)) {
      return accumulator;
    }
    return accumulator;
  }, [filtered[0]]);
  return leastConnection;
};

/**
 * @returns all upstream models
 */
export const getAllModels = () =>
  upstreamState.map(({ model }) => model);
