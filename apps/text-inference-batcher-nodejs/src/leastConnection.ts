import { Upstream } from "./globalState.js";

export function leastConnection(accumulator: Upstream[], currentValue: Upstream) {
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
}
