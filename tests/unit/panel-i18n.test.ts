import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ur } from "../../src/lib/panel-tr/ur";
import { ar } from "../../src/lib/panel-tr/ar";
import { hi } from "../../src/lib/panel-tr/hi";
import { pa } from "../../src/lib/panel-tr/pa";
import { zh } from "../../src/lib/panel-tr/zh";

const LANG_TR: Record<string, Record<string, string>> = { ur, ar, hi, pa, zh };

// Examples and technical text that stay as they are in every language.
const SAME = new Set([
  "name, price", "slug, sku, stock, compare_at_price, cost_price, wholesale_price, category, brand, barcode, description, status, images, tags",
  "EID20", "shop.example.com", ".btn-brand { border-radius: 9999px; }", "https://example.com/webhooks/store",
  "Main branch | 12 Mall Road, Lahore | 042-1234567 | 10am–9pm", "A", "B",
]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".tsx") ? [path.join(dir, e.name)] : []));
}

for (const [code, tr] of Object.entries(LANG_TR))
test(`every store panel text has a ${code} translation`, () => {
  const files = [...walk("src/app/s/[site]/manage/(panel)"), ...walk("src/components/manage"), "src/components/admin/toggles.tsx"];
  const missing = new Set<string>();
  for (const f of files)
    for (const m of fs.readFileSync(f, "utf8").matchAll(/(?<![\w.$])T\(("(?:[^"\\]|\\.)*")\)/g)) {
      const s = JSON.parse(m[1]) as string;
      if (!SAME.has(s) && !tr[s]) missing.add(s);
    }
  assert.deepEqual([...missing], []);
});

// Save and error messages from the panel's server actions.
import { translate } from "../../src/lib/tr-match";
import { urMsg } from "../../src/lib/panel-tr/msg-ur";
import { arMsg } from "../../src/lib/panel-tr/msg-ar";
import { hiMsg } from "../../src/lib/panel-tr/msg-hi";
import { paMsg } from "../../src/lib/panel-tr/msg-pa";
import { zhMsg } from "../../src/lib/panel-tr/msg-zh";

const MSG: Record<string, Record<string, string>> = { ur: urMsg, ar: arMsg, hi: hiMsg, pa: paMsg, zh: zhMsg };

function actionMessages(): string[] {
  const dir = "src/app/s/[site]/manage";
  const out = new Set<string>();
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith("actions.ts"))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/\b(?:error|ok)\s*:\s*(?:\w+\s*\?\s*)?("(?:[^"\\]|\\.)*"|`[^`]*`)(?:\s*:\s*("(?:[^"\\]|\\.)*"))?/g))
      for (const lit of [m[1], m[2]]) {
        if (!lit || lit.includes("${") && /\$\{[^}]*`/.test(lit)) continue;
        let i = 0;
        out.add(lit[0] === '"' ? JSON.parse(lit) : lit.slice(1, -1).replace(/\$\{[^}]*\}/g, () => `{${i++}}`));
      }
  }
  return [...out];
}

for (const [code, msgs] of Object.entries(MSG))
  test(`every panel save/error message has a ${code} translation`, () => {
    const dict = { ...msgs };
    const missing = actionMessages().filter((s) => s !== "{0}: {1} → {2}." && translate(dict, s) === s);
    assert.deepEqual(missing, []);
  });

test("messages with changing parts are translated around them", () => {
  assert.equal(translate(urMsg, "Refunded Rs 1,500."), "Rs 1,500 واپس کر دیے گئے۔");
  assert.equal(translate(zhMsg, "Sale #42 complete. Change due: Rs 50."), "销售 #42 完成。找零：Rs 50。");
  assert.equal(translate(zhMsg, "Gift card ABCD-1234 created for Rs 2,000. Emailed to a@b.co."), "礼品卡 ABCD-1234 已创建，面额 Rs 2,000。 已发送邮件至 a@b.co。");
  assert.equal(translate(zhMsg, "Something new."), "Something new.");
});
