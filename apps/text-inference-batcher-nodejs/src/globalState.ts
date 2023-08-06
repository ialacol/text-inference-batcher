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

/**
 * @returns the upstream(s) filtered by model
 */
export const filterByModel = (model: string): UpstreamState => upstreamState.filter(({ model: upstreamModel }) => upstreamModel === model);

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
