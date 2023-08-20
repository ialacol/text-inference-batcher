import { type Upstream } from "./globalState.js";

export function leastLatency(accumulator: Upstream, currentValue: Upstream) {
  if (currentValue.latency < accumulator.latency) {
    return currentValue;
  }
  return accumulator;
}
