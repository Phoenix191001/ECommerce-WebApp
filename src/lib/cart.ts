import "server-only";
import { cookies } from "next/headers";
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
  }[];
  count: number;
  subtotal: number;
  discountCode?: string;
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
          const ex = cart.items.find((x) => String(x.product) === String(it.product) && String(x.variant ?? "") === String(it.variant ?? ""));
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

export const lineKey = (product: string, variant?: string | null) => (variant ? `${product}:${variant}` : product);

/** Cart with current prices and stock from the catalog (variants, sales, wholesale, volume tiers). */
export async function viewCart(store: StoreContext): Promise<CartView> {
  const cart = await findCart(store);
  if (!cart || !cart.items.length) return { id: cart ? String(cart._id) : null, items: [], count: 0, subtotal: 0 };
  const m = await storeModels(store);
  const session = await getStoreSession(store);
  const wholesale = session?.role === "customer" ? !!(await m.User.findById(session.uid, { wholesale: 1 }).lean())?.wholesale : false;
  const products = await m.Product.find({ _id: { $in: cart.items.map((i) => i.product) }, status: "active" }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const ctx = { features: store.features, wholesale };
  const items: CartView["items"] = [];
  for (const i of cart.items) {
    const p = byId.get(String(i.product));
    if (!p || !isPublished(p, store.features)) continue;
    const vid = i.variant ? String(i.variant) : undefined;
    const v = findVariant(p, vid);
    if (p.variants?.length && !v) continue; // variant removed since it was added
    const { price, rule } = unitPrice(p, vid, i.qty, ctx);
    items.push({
      key: lineKey(String(p._id), vid),
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
      stock: stockOf(p, vid),
    });
  }
  return {
    id: String(cart._id),
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
    discountCode: cart.discountCode ?? undefined,
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
