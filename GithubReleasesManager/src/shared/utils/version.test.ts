import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareVersions, isVersionNewer } from "./version.ts";

describe("version comparison", () => {
  it("compares major, minor, and patch numbers", () => {
    assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
    assert.equal(compareVersions("1.2.0", "1.3.0"), -1);
    assert.equal(compareVersions("1.2.4", "1.2.3"), 1);
    assert.equal(compareVersions("1.2", "1.2.0"), 0);
  });

  it("normalizes v prefixes and surrounding whitespace", () => {
    assert.equal(compareVersions(" v1.0.0 ", "1.0.0"), 0);
    assert.equal(compareVersions("V1.0.1", "1.0.0"), 1);
  });

  it("orders common pre-release labels before stable releases", () => {
    assert.equal(compareVersions("1.0.0-alpha", "1.0.0-beta"), -1);
    assert.equal(compareVersions("1.0.0-beta", "1.0.0-rc"), -1);
    assert.equal(compareVersions("1.0.0-rc", "1.0.0"), -1);
    assert.equal(compareVersions("1.0.0", "1.0.0-alpha"), 1);
  });

  it("compares numeric pre-release identifiers numerically", () => {
    assert.equal(compareVersions("1.0.0-alpha.10", "1.0.0-alpha.2"), 1);
    assert.equal(compareVersions("1.0.0-beta10", "1.0.0-beta2"), 1);
    assert.equal(compareVersions("1.0.0-rc.1", "1.0.0-rc.1"), 0);
  });

  it("ignores build metadata when determining precedence", () => {
    assert.equal(compareVersions("1.0.0+build.1", "1.0.0+build.2"), 0);
    assert.equal(compareVersions("1.0.0-alpha+build.1", "1.0.0-alpha+build.2"), 0);
  });

  it("falls back to lexical ordering for unknown labels", () => {
    assert.equal(compareVersions("1.0.0-canary", "1.0.0-dev"), -1);
  });

  it("reports only strictly newer versions", () => {
    assert.equal(isVersionNewer("1.0.1", "1.0.0"), true);
    assert.equal(isVersionNewer("1.0.0", "1.0.0"), false);
    assert.equal(isVersionNewer("1.0.0-alpha", "1.0.0"), false);
  });
});
