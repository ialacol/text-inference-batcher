import assert from "assert/strict";
import { describe, it } from "node:test";
import { parseUpstreams } from "./parseUpstreams.js";

describe("parseUpstreams()", () => {
  it("parse string into a URL Set", () => {
    const urlString1 = "http://llama.ai:6666";
    const urlString2 = "http://falcon.ai:6667";
    const result = parseUpstreams(`${urlString1},${urlString2}`);
    assert.deepStrictEqual(result, new Set([new URL(urlString1), new URL(urlString2)]));
  });
  it("tolerates if there are spaces", () => {
    const urlString1 = "http://llama.ai:6666";
    const urlString2 = "http://falcon.ai:6667";
    const result = parseUpstreams(` ${urlString1}, ${urlString2} `);
    assert.deepStrictEqual(result, new Set([new URL(urlString1), new URL(urlString2)]));
  });
  it("tolerates if string ends with / (href format)", () => {
    const urlString1 = "http://llama.ai:6666/";
    const urlString2 = "http://falcon.ai:6667/";
    const result = parseUpstreams(` ${urlString1}, ${urlString2} `);
    assert.deepStrictEqual(result, new Set([new URL(urlString1), new URL(urlString2)]));
  });
  it("throws if UPSTREAMS is not comma separated", () => {
    const urlString1 = "http://llama.ai:6666";
    const urlString2 = "http://falcon.ai:6667";
    assert.throws(
      () => parseUpstreams(`${urlString1}${urlString2}`),
      Error(`${urlString1}${urlString2} is not a valid URL`),
    );
  });
  it("throws if UPSTREAMS is in [url,url] format", () => {
    const urlString1 = "http://llama.ai:6666";
    const urlString2 = "http://falcon.ai:6667";
    assert.throws(
      () => parseUpstreams(`[${urlString1},${urlString2}]`),
      Error("[http://llama.ai:6666 is not a valid URL"),
    );
  });
  it("throws if UPSTREAMS is an empty string", () => {
    assert.throws(() => parseUpstreams(""), Error("env.UPSTREAMS is missing"));
  });
  it("throws if UPSTREAMS is undefined", () => {
    assert.throws(() => parseUpstreams(undefined), Error("env.UPSTREAMS is missing"));
  });
  it("throws if UPSTREAMS is not valid url", () => {
    assert.throws(() => parseUpstreams("http://"), Error("http:// is not a valid URL"));
  });
  it("throws if one url in the UPSTREAMS is not valid url", () => {
    const validString = "http://llama.ai:6666";
    assert.throws(() => parseUpstreams(`${validString},http://`), Error("http:// is not a valid URL"));
  });
  it("throws if UPSTREAMS is not http/https", () => {
    assert.throws(
      () => parseUpstreams("websocket://8.8.8.8:6666"),
      Error("websocket://8.8.8.8:6666 is not a valid URL", { cause: Error("websocket:// is not supported") }),
    );
  });
  it("throws if one url in the UPSTREAMS is not http/https", () => {
    const validString = "http://llama.ai:6666";
    assert.throws(
      () => parseUpstreams(`${validString},websocket://8.8.8.8:6666`),
      Error("websocket://8.8.8.8:6666 is not a valid URL", { cause: Error("websocket:// is not supported") }),
    );
  });
  it("throws if UPSTREAMS has pathname", () => {
    assert.throws(
      () => parseUpstreams("http://8.8.8.8:6666/not-allowed"),
      Error("http://8.8.8.8:6666/not-allowed is not a valid URL", {
        cause: Error("should not has pathname:/not-allowed"),
      }),
    );
  });
  it("throws if one url in the UPSTREAMS has pathname", () => {
    assert.throws(
      () => parseUpstreams("http://8.8.8.9:6667,http://8.8.8.8:6666/not-allowed"),
      Error("http://8.8.8.8:6666/not-allowed is not a valid URL", {
        cause: Error("should not has pathname:/not-allowed"),
      }),
    );
  });
});
