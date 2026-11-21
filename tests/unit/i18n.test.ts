import { test } from "node:test";
import assert from "node:assert/strict";
import { DICTS, fill, payText, statusText } from "../../src/lib/i18n";

for (const lang of Object.keys(DICTS) as (keyof typeof DICTS)[]) {
  if (lang === "en") continue;
  test(`${lang}: every English phrase is translated, with the same {placeholders}`, () => {
    const d = DICTS[lang] as Record<string, string>;
    assert.deepEqual(Object.keys(DICTS.en).filter((k) => !d[k]?.trim()), []);
    assert.deepEqual(Object.keys(d).filter((k) => !(k in DICTS.en)), []);
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    assert.deepEqual(Object.entries(DICTS.en).filter(([k, v]) => vars(v) !== vars(d[k])).map(([k]) => k), []);
  });
}

test("fill and status helpers", () => {
  assert.equal(fill(DICTS.en.orderNo, { n: 1001 }), "Order #1001");
  assert.equal(statusText(DICTS.en, "shipped"), "On the way");
  assert.equal(statusText(DICTS.en, "weird"), "weird");
  assert.equal(payText(DICTS.en, "partially_refunded"), "partly refunded");
});
