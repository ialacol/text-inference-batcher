import assert from "assert/strict";
import { describe, it } from "node:test";
import { type Upstream } from "./globalState.js";
import { getRandomUpstream } from "./testHelpers.js";
import { leastConnection } from "./leastConnection.js";

describe("leastConnection()", () => {
  it("return the upstream with least connection", () => {
    const u0: Upstream = getRandomUpstream({ connections: 1 });
    const u1: Upstream = getRandomUpstream({ connections: 2 });
    const u2: Upstream = getRandomUpstream({ connections: 5 });
    const result = [u0, u1, u2].reduce(leastConnection, []);
    assert.deepStrictEqual(result, [u0]);
  });
  it("return the upstream(s) with least connection", () => {
    const u0: Upstream = getRandomUpstream({ connections: 0 });
    const u1: Upstream = getRandomUpstream({ connections: 0 });
    const u2: Upstream = getRandomUpstream({ connections: 5 });
    const result = [u0, u1, u2].reduce(leastConnection, []);
    assert.deepStrictEqual(result, [u0, u1]);
  });
  it("return all the upstream(s) if all has the same connection number", () => {
    const u0: Upstream = getRandomUpstream({ connections: 0 });
    const u1: Upstream = getRandomUpstream({ connections: 0 });
    const u2: Upstream = getRandomUpstream({ connections: 0 });
    const result = [u0, u1, u2].reduce(leastConnection, []);
    assert.deepStrictEqual(result, [u0, u1, u2]);
  });
});
