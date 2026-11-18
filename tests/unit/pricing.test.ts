import { test } from "node:test";
import assert from "node:assert/strict";
import { basePrice, fromPrice, isPublished, stockOf, totalStock, unitPrice } from "../../src/lib/pricing";

const on = (...ids: number[]) => Object.fromEntries(ids.map((n) => [`F-${String(n).padStart(2, "0")}`, true]));
const product = {
  price: 1000,
  stock: 5,
  variants: [
    { _id: "a", name: "S", stock: 3 },
    { _id: "b", name: "XL", price: 1200, stock: 0 },
  ],
  volumeTiers: [{ minQty: 10, price: 800 }, { minQty: 5, price: 900 }],
  salePrice: 850,
  saleEndsAt: new Date(Date.now() + 3600_000),
  wholesalePrice: 700,
};

test("variant price overrides the product price (F-02)", () => {
  const f = on(2);
  assert.equal(basePrice(product, "a", { features: f }), 1000);
  assert.equal(basePrice(product, "b", { features: f }), 1200);
  assert.equal(fromPrice(product, { features: f }), 1000);
});

test("flash sale applies only while running (F-66)", () => {
  assert.equal(basePrice(product, null, { features: on(66) }), 850);
  assert.equal(basePrice({ ...product, saleEndsAt: new Date(Date.now() - 1000) }, null, { features: on(66) }), 1000);
  assert.equal(basePrice(product, null, { features: {} }), 1000);
});

test("volume tiers pick the best tier for the quantity (F-62)", () => {
  const f = on(62);
  assert.equal(unitPrice(product, null, 4, { features: f }).price, 1000);
  assert.equal(unitPrice(product, null, 5, { features: f }).price, 900);
  assert.equal(unitPrice(product, null, 12, { features: f }).price, 800);
});

test("wholesale customers get the wholesale price (F-61)", () => {
  assert.equal(basePrice(product, null, { features: on(61), wholesale: true }), 700);
  assert.equal(basePrice(product, null, { features: on(61), wholesale: false }), 1000);
});

test("stock is per variant when variants exist", () => {
  assert.equal(stockOf(product, "a"), 3);
  assert.equal(stockOf(product, "b"), 0);
  assert.equal(totalStock(product), 3);
  assert.equal(stockOf({ price: 1, stock: 7 }), 7);
});

test("scheduled products stay hidden until their publish time (F-92)", () => {
  const later = { price: 1, stock: 1, status: "active", publishAt: new Date(Date.now() + 60_000) };
  assert.equal(isPublished(later, on(92)), false);
  assert.equal(isPublished(later, {}), true);
});
