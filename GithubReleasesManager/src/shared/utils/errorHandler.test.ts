import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getErrorMessage } from "./errorHandler.ts";

describe("getErrorMessage", () => {
  it("returns Error messages", () => {
    assert.equal(getErrorMessage(new Error("boom")), "boom");
  });

  it("returns string errors as-is", () => {
    assert.equal(getErrorMessage("plain failure"), "plain failure");
  });

  it("falls back for non-message values", () => {
    assert.equal(getErrorMessage(null), "An unknown error occurred");
    assert.equal(getErrorMessage({ message: "not an Error instance" }), "An unknown error occurred");
    assert.equal(getErrorMessage(42, "custom fallback"), "custom fallback");
  });
});
