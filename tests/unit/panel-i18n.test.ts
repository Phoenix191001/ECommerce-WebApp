import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ur } from "../../src/lib/panel-tr/ur";

// Examples and technical text that stay as they are in every language.
const SAME = new Set([
  "name, price", "slug, sku, stock, compare_at_price, cost_price, wholesale_price, category, brand, barcode, description, status, images, tags",
  "EID20", "shop.example.com", ".btn-brand { border-radius: 9999px; }", "https://example.com/webhooks/store",
  "Main branch | 12 Mall Road, Lahore | 042-1234567 | 10am–9pm", "A", "B",
]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".tsx") ? [path.join(dir, e.name)] : []));
}

test("every store panel text has an Urdu translation", () => {
  const files = [...walk("src/app/s/[site]/manage/(panel)"), ...walk("src/components/manage"), "src/components/admin/toggles.tsx"];
  const missing = new Set<string>();
  for (const f of files)
    for (const m of fs.readFileSync(f, "utf8").matchAll(/(?<![\w.$])T\(("(?:[^"\\]|\\.)*")\)/g)) {
      const s = JSON.parse(m[1]) as string;
      if (!SAME.has(s) && !ur[s]) missing.add(s);
    }
  assert.deepEqual([...missing], []);
});
