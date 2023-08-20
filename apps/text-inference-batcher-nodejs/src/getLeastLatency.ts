import { type Upstream } from "./globalState.js";

export function getLeastLatency(accumulator: Upstream, currentValue: Upstream) {
  if (currentValue.latency < accumulator.latency) {
    return currentValue;
  }
  return accumulator;
}
