import { test } from "node:test";
import assert from "node:assert/strict";
import { DOCS } from "../../src/lib/doc-i18n";

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

for (const [code, d] of Object.entries(DOCS))
  test(`${code}: emails and invoice have every text, with the same {placeholders}`, () => {
    for (const [k, en] of Object.entries(DOCS.en)) {
      const v = (d as Record<string, string>)[k];
      assert.ok(v, `${code}.${k} missing`);
      assert.deepEqual(holes(v), holes(en), `${code}.${k}`);
      if (code !== "en" && !/^[{🖨️🎁]/.test(en)) assert.notEqual(v, en, `${code}.${k} untranslated`);
    }
  });
