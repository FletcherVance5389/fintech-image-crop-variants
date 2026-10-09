import test from "node:test";
import assert from "node:assert/strict";
import { decideRisk } from "./risk_decision.ts";

test("high-value payment becomes a review action", () => {
  assert.equal(decideRisk(100000), "review");
  assert.equal(decideRisk(99999), "allow");
});
