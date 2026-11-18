import { test } from "node:test";
import assert from "node:assert/strict";
import { fuzzyScore } from "../../src/lib/fuzzy";
import { parseCsv } from "../../src/lib/csv";
import { validateSubdomain } from "../../src/lib/subdomain";
import { isSafeWebhookUrl } from "../../src/lib/url-safety";

test("typo-tolerant search matches close spellings (F-96)", () => {
  assert.ok(fuzzyScore("earbudz", "Wireless Earbuds") < Infinity);
  assert.ok(fuzzyScore("chrger", "Phone Charger") < Infinity);
  assert.equal(fuzzyScore("laptop", "Phone Charger"), Infinity);
});

test("CSV parser handles quotes, commas and newlines", () => {
  const rows = parseCsv('name,price\n"Mug, blue",850\n"Say ""hi""",10\r\n');
  assert.deepEqual(rows, [["name", "price"], ["Mug, blue", "850"], ['Say "hi"', "10"]]);
});

test("subdomains: reserved, invalid and valid (FR-U-03)", () => {
  assert.equal(validateSubdomain("admin").ok, false);
  assert.equal(validateSubdomain("-bad").ok, false);
  assert.equal(validateSubdomain("ab").ok, false);
  assert.deepEqual(validateSubdomain("Ali-Shop"), { ok: true, value: "ali-shop" });
});

test("webhook URLs must be public HTTPS (SSRF guard)", () => {
  assert.equal(isSafeWebhookUrl("https://hooks.zapier.com/x"), true);
  for (const bad of ["http://example.com", "https://localhost/x", "https://127.0.0.1", "https://169.254.169.254/latest", "https://10.0.0.5", "https://192.168.1.2", "https://[::1]/"])
    assert.equal(isSafeWebhookUrl(bad), false, bad);
});
