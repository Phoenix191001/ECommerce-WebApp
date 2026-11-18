import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURES, FEATURE_MAP, DESCRIPTIONS, IMPLEMENTED, STARTER_PACK, defaultToggles, effectiveToggles, enableChain, missingPrereqs } from "../../src/lib/features";

test("catalog has 122 features with descriptions and valid prerequisites", () => {
  assert.equal(FEATURES.length, 122);
  for (const f of FEATURES) {
    assert.ok(DESCRIPTIONS[f.id], `${f.id} has a description`);
    for (const r of f.requires) assert.ok(FEATURE_MAP[r], `${f.id} requires known ${r}`);
  }
  for (const id of IMPLEMENTED) assert.ok(FEATURE_MAP[id], `implemented ${id} exists`);
});

test("prerequisites block enabling and the chain turns them on in order (FR-A-03, UX-03)", () => {
  const state = { "F-22": false, "F-10": false };
  assert.deepEqual(missingPrereqs("F-10", state), ["F-22"]);
  // Refunds at POS need F-34 (which needs F-17) and F-38.
  const chain = enableChain("F-37", {});
  assert.ok(chain.indexOf("F-17") < chain.indexOf("F-34"));
  assert.ok(chain.indexOf("F-34") < chain.indexOf("F-37"));
  assert.ok(chain.includes("F-38"));
});

test("a feature is effective only when its prerequisites are effective", () => {
  const eff = effectiveToggles({ "F-10": true, "F-22": false });
  assert.equal(eff["F-10"], false);
  assert.equal(effectiveToggles({ "F-10": true, "F-22": true })["F-10"], true);
});

test("new stores get the starter pack, limited to the plan", () => {
  const all = defaultToggles(FEATURES.map((f) => f.id));
  for (const id of STARTER_PACK) assert.equal(all[id], true, id);
  const limited = defaultToggles(["F-01"]);
  assert.equal(limited["F-01"], true);
  assert.equal(limited["F-22"], false);
});
