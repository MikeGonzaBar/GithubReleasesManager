import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBytes } from "./format.ts";

describe("formatBytes", () => {
  it("formats byte values without decimals", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(1), "1 B");
    assert.equal(formatBytes(1023), "1023 B");
  });

  it("formats larger units with two decimal places", () => {
    assert.equal(formatBytes(1024), "1.00 KB");
    assert.equal(formatBytes(1536), "1.50 KB");
    assert.equal(formatBytes(1024 ** 2), "1.00 MB");
    assert.equal(formatBytes(1024 ** 3), "1.00 GB");
    assert.equal(formatBytes(1024 ** 4), "1.00 TB");
  });

  it("treats invalid or negative sizes as zero", () => {
    assert.equal(formatBytes(-1), "0 B");
    assert.equal(formatBytes(Number.NaN), "0 B");
    assert.equal(formatBytes(Number.POSITIVE_INFINITY), "0 B");
  });
});
