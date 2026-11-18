import { test } from "node:test";
import assert from "node:assert/strict";
import { DICTS, fill, payText, statusText } from "../../src/lib/i18n";

test("Urdu has every English key, none empty", () => {
  const en = Object.keys(DICTS.en);
  const ur = DICTS.ur as Record<string, string>;
  assert.deepEqual(en.filter((k) => !ur[k]?.trim()), []);
  assert.deepEqual(Object.keys(ur).filter((k) => !(k in DICTS.en)), []);
});

test("Urdu keeps the same {placeholders}", () => {
  const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  const ur = DICTS.ur as Record<string, string>;
  const bad = Object.entries(DICTS.en).filter(([k, v]) => vars(v) !== vars(ur[k]));
  assert.deepEqual(bad.map(([k]) => k), []);
});

test("fill and status helpers", () => {
  assert.equal(fill(DICTS.en.orderNo, { n: 1001 }), "Order #1001");
  assert.equal(statusText(DICTS.en, "shipped"), "On the way");
  assert.equal(statusText(DICTS.en, "weird"), "weird");
  assert.equal(payText(DICTS.en, "partially_refunded"), "partly refunded");
});
