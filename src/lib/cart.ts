import "server-only";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";
import { getStoreSession } from "./store-auth";

export type CartView = {
  id: string | null;
  items: { product: string; name: string; price: number; qty: number; image?: string; slug: string; stock: number }[];
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
          const ex = cart.items.find((x) => String(x.product) === String(it.product));
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

/** Cart with current prices and stock from the catalog. */
export async function viewCart(store: StoreContext): Promise<CartView> {
  const cart = await findCart(store);
  if (!cart || !cart.items.length) return { id: cart ? String(cart._id) : null, items: [], count: 0, subtotal: 0 };
  const m = await storeModels(store);
  const products = await m.Product.find({ _id: { $in: cart.items.map((i) => i.product) }, status: "active" }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const items = cart.items
    .filter((i) => byId.has(String(i.product)))
    .map((i) => {
      const p = byId.get(String(i.product))!;
      return { product: String(p._id), name: p.name, price: p.price, qty: i.qty, image: p.images?.[0], slug: p.slug, stock: p.stock };
    });
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
