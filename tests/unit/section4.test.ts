import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBlocks, newBlock, youtubeId, BLOCK_TYPES } from "../../src/lib/blocks";
import { significance } from "../../src/lib/ab-math";
import { newGiftCode, normCode } from "../../src/lib/giftcode";
import { APPS, activeApps } from "../../src/lib/apps";
import { showMoney } from "../../src/lib/money";

test("page builder keeps only safe blocks and links", () => {
  const out = cleanBlocks([
    { type: "hero", title: "Hi", text: "x", image: "javascript:alert(1)", button: "Go", link: "javascript:alert(1)" },
    { type: "image", url: "http://insecure.example/a.png" },
    { type: "image", url: "https://cdn.example/a.png", caption: "ok", link: "/p/shirt" },
    { type: "products", limit: 500, category: "Shoes" },
    { type: "script", src: "https://evil" },
    { type: "video", url: "https://youtu.be/dQw4w9WgXcQ" },
  ]);
  assert.deepEqual(out.map((b) => b.type), ["hero", "image", "products", "video"]);
  const hero = out[0] as Extract<(typeof out)[number], { type: "hero" }>;
  assert.equal(hero.image, "");
  assert.equal(hero.link, "");
  assert.equal((out[2] as { limit: number }).limit, 24);
  assert.equal(cleanBlocks("nope").length, 0);
  for (const t of BLOCK_TYPES) assert.equal(cleanBlocks([newBlock(t.type)]).length, t.type === "image" || t.type === "video" ? 0 : 1);
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1"), "dQw4w9WgXcQ");
});

test("A/B significance", () => {
  assert.equal(significance(0, 0, 0, 0), 0);
  assert.ok(significance(1000, 20, 1000, 60) >= 99);
  assert.ok(significance(100, 5, 100, 6) < 50);
});

test("gift card codes", () => {
  const c = newGiftCode();
  assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normCode(" abcd efgh-jkmn "), "ABCD-EFGH-JKMN");
});

test("apps only run with valid settings", () => {
  assert.ok(APPS.every((a) => a.id && a.name));
  assert.equal(activeApps([{ id: "gtm", enabled: true, config: { id: "GTM-ABC123" } }]).length, 1);
  assert.equal(activeApps([{ id: "gtm", enabled: true, config: { id: "x');alert(1)//" } }]).length, 0);
  assert.equal(activeApps([{ id: "gtm", enabled: false, config: { id: "GTM-ABC123" } }]).length, 0);
  assert.equal(activeApps([{ id: "slack", enabled: true, config: { url: "https://evil.example/hook" } }]).length, 0);
  assert.equal(activeApps([{ id: "salespop", enabled: true, config: {} }]).length, 1);
});

test("display currency", () => {
  assert.match(showMoney(1000, "PKR"), /1,000/);
  assert.equal(showMoney(1000, "PKR", { code: "USD", rate: 0.0036 }), "$3.60");
  assert.match(showMoney(1000, "PKR", { code: "ZZZ", rate: 2 }), /2,?000/);
});
