import assert from "assert/strict";
import { describe, it } from "node:test";
import { leastLatency } from "./leastLatency.js";
import { type Upstream } from "./globalState.js";
import { getRandomUpstream } from "./testHelpers.js";

describe("leastLatency()", () => {
  it("return upstream with least latency", () => {
    const u0: Upstream = getRandomUpstream({ latency: 1 });
    const u1: Upstream = getRandomUpstream({ latency: 2 });
    const u2: Upstream = getRandomUpstream({ latency: 5 });
    const result = [u0, u1, u2].reduce(leastLatency);
    assert.strictEqual(result, u0);
  });
  it("return upstream with least latency if there is only one", () => {
    const u0: Upstream = getRandomUpstream({ latency: 0 });
    const result = [u0].reduce(leastLatency);
    assert.strictEqual(result, u0);
  });
  it("if same latency, return first item in the list", () => {
    const u0: Upstream = getRandomUpstream({ latency: 100 });
    const u1: Upstream = getRandomUpstream({ latency: 100 });
    const u2: Upstream = getRandomUpstream({ latency: 100 });
    const result = [u0, u1, u2].reduce(leastLatency);
    assert.strictEqual(result, u0);
  });

  it("if same latency, return first found item in the list", () => {
    const u0: Upstream = getRandomUpstream({ latency: 120 });
    const u1: Upstream = getRandomUpstream({ latency: 100 });
    const u2: Upstream = getRandomUpstream({ latency: 100 });
    const result = [u0, u1, u2].reduce(leastLatency);
    assert.strictEqual(result, u1);
  });

  it("works even with negative latency", () => {
    const u0: Upstream = getRandomUpstream({ latency: -1 });
    const u1: Upstream = getRandomUpstream({ latency: 100 });
    const u2: Upstream = getRandomUpstream({ latency: 100 });
    const result = [u0, u1, u2].reduce(leastLatency);
    assert.strictEqual(result, u0);
  });
});
