import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { Types } from "mongoose";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";
import { getStoreSession } from "./store-auth";
import { stockOf, unitPrice, findVariant, isPublished } from "./pricing";

export type CartView = {
  id: string | null;
  items: {
    key: string; // product id, or product:variant
    product: string;
    variant?: string;
    variantName?: string;
    name: string;
    price: number;
    listPrice: number;
    rule?: string;
    qty: number;
    image?: string;
    slug: string;
    stock: number;
    kind: "physical" | "digital" | "giftcard";
    custom?: { label: string; value: string }[];
    bundle?: { product: string; qty: number; name: string }[];
    category: string;
  }[];
  count: number;
  subtotal: number;
  discountCode?: string;
  /** Some item needs delivery to an address (false when the cart is only downloads and gift cards). */
  needsShipping: boolean;
};

export const cartCookie = (store: StoreContext) => `cart_${store.id}`;

/** Cart for the signed-in customer, or the guest cart from the cookie (FR-C-02). */
export async function findCart(store: StoreContext, create = false) {
  const m = await storeModels(store);
  const session = await getStoreSession(store);
  const jar = await cookies();
  const cid = jar.get(cartCookie(store))?.value;
  if (session?.role === "customer") {
    let cart = await m.Cart.findOne({ user: session.uid });
    // Merge a guest cart into the account cart after sign-in.
    if (cid && Types.ObjectId.isValid(cid)) {
      const guest = await m.Cart.findOne({ _id: cid, user: { $exists: false } });
      if (guest && guest.items.length) {
        if (!cart) cart = new m.Cart({ user: new Types.ObjectId(session.uid), items: [] });
        for (const it of guest.items) {
          const ex = cart.items.find((x) => keyOf(x) === keyOf(it));
          if (ex) ex.qty = Math.min(999, ex.qty + it.qty);
          else cart.items.push(it);
        }
        await cart.save();
        await guest.deleteOne();
      }
    }
    if (!cart && create) cart = await m.Cart.create({ user: new Types.ObjectId(session.uid), items: [] });
    return cart;
  }
  let cart = cid && Types.ObjectId.isValid(cid) ? await m.Cart.findOne({ _id: cid, user: { $exists: false } }) : null;
  if (!cart && create) {
    cart = await m.Cart.create({ items: [] });
    jar.set(cartCookie(store), String(cart._id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return cart;
}

type Custom = { label: string; value: string }[] | null | undefined;
const customHash = (c: Custom) =>
  c?.length ? crypto.createHash("sha1").update(JSON.stringify(c.map((x) => [x.label, x.value]))).digest("hex").slice(0, 10) : "";

/** One cart line per product + variant + personalisation text (F-63). */
export const lineKey = (product: string, variant?: string | null, custom?: Custom) => {
  const h = customHash(custom);
  return h ? `${product}:${variant ?? ""}:${h}` : variant ? `${product}:${variant}` : product;
};
export const keyOf = (i: { product: unknown; variant?: unknown; custom?: Custom }) =>
  lineKey(String(i.product), i.variant ? String(i.variant) : undefined, i.custom);

type Part = { _id: unknown; stock: number; variants?: unknown[] };
/** F-13: how many bundles the parts in stock can make. */
export function bundleStock(bundle: { product: unknown; qty: number }[], parts: Map<string, Part>) {
  let n = Infinity;
  for (const b of bundle) {
    const p = parts.get(String(b.product));
    n = Math.min(n, p ? Math.floor(Math.max(0, p.stock) / Math.max(1, b.qty)) : 0);
  }
  return Number.isFinite(n) ? n : 0;
}

/** Products that make up bundles, keyed by id. */
export async function loadParts(store: StoreContext, products: { bundle?: { product: unknown }[] | null }[]) {
  const ids = products.flatMap((p) => (p.bundle ?? []).map((b) => b.product));
  if (!ids.length) return new Map<string, Part>();
  const m = await storeModels(store);
  const parts = await m.Product.find({ _id: { $in: ids } }, { stock: 1, variants: 1, name: 1 }).lean();
  return new Map(parts.map((p) => [String(p._id), p as Part]));
}

/** Stock a shopper can buy: unlimited for downloads and gift cards, bundle parts for bundles. */
export function sellableStock(
  p: Parameters<typeof stockOf>[0] & { kind?: string | null; bundle?: { product: unknown; qty: number }[] | null },
  vid: string | undefined,
  parts: Map<string, Part>,
  features: Record<string, boolean>,
) {
  if ((features["F-12"] && p.kind === "digital") || (features["F-32"] && p.kind === "giftcard")) return 9999;
  if (features["F-13"] && p.bundle?.length) return bundleStock(p.bundle, parts);
  return stockOf(p, vid);
}

/** Cart with current prices and stock from the catalog (variants, sales, wholesale, volume tiers). */
export async function viewCart(store: StoreContext): Promise<CartView> {
  const cart = await findCart(store);
  if (!cart || !cart.items.length) return { id: cart ? String(cart._id) : null, items: [], count: 0, subtotal: 0, needsShipping: false };
  const m = await storeModels(store);
  const session = await getStoreSession(store);
  const wholesale = session?.role === "customer" ? !!(await m.User.findById(session.uid, { wholesale: 1 }).lean())?.wholesale : false;
  const products = await m.Product.find({ _id: { $in: cart.items.map((i) => i.product) }, status: "active" }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const parts = await loadParts(store, products);
  const ctx = { features: store.features, wholesale };
  const items: CartView["items"] = [];
  for (const i of cart.items) {
    const p = byId.get(String(i.product));
    if (!p || !isPublished(p, store.features)) continue;
    const vid = i.variant ? String(i.variant) : undefined;
    const v = findVariant(p, vid);
    if (p.variants?.length && !v) continue; // variant removed since it was added
    const { price, rule } = unitPrice(p, vid, i.qty, ctx);
    const kind = (p.kind === "digital" && store.features["F-12"]) || (p.kind === "giftcard" && store.features["F-32"]) ? p.kind : "physical";
    const custom = (store.features["F-63"] || kind === "giftcard") && i.custom?.length ? i.custom.map((c) => ({ label: c.label, value: c.value })) : undefined;
    const bundle = store.features["F-13"] && p.bundle?.length ? p.bundle.map((b) => ({ product: String(b.product), qty: b.qty, name: b.name })) : undefined;
    items.push({
      key: lineKey(String(p._id), vid, custom),
      product: String(p._id),
      variant: vid,
      variantName: v?.name,
      name: p.name,
      price,
      listPrice: unitPrice(p, vid, 1, ctx).price,
      rule,
      qty: i.qty,
      image: p.images?.[0],
      slug: p.slug,
      stock: sellableStock(p, vid, parts, store.features),
      kind,
      custom,
      bundle,
      category: p.category ?? "",
    });
  }
  return {
    id: String(cart._id),
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
    discountCode: cart.discountCode ?? undefined,
    needsShipping: items.some((i) => i.kind === "physical"),
  };
}

/** Validate a discount code against a subtotal (F-27 / F-21). */
export async function evaluateDiscount(store: StoreContext, code: string | undefined, subtotal: number) {
  if (!code || !store.features["F-27"]) return { amount: 0 };
  const m = await storeModels(store);
  const d = await m.Discount.findOne({ code: code.toUpperCase().trim() }).lean();
  if (!d || !d.active) return { amount: 0, error: "That code isn't valid." };
  if (d.expiresAt && d.expiresAt < new Date()) return { amount: 0, error: "That code has expired." };
  if (d.usageLimit > 0 && d.used >= d.usageLimit) return { amount: 0, error: "That code has been used up." };
  if (subtotal < d.minSubtotal) return { amount: 0, error: `Spend at least ${d.minSubtotal} to use this code.` };
  const amount = d.type === "percent" ? Math.round((subtotal * Math.min(100, d.value)) / 100) : Math.min(subtotal, d.value);
  return { amount, code: d.code };
}
