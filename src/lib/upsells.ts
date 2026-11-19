import "server-only";
import { Types } from "mongoose";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";
import type { CartView } from "./cart";
import { visibleFilter } from "./pricing";

/** F-57: products picked by the owner for what's in the cart, else popular items from the same categories. */
export async function upsellsFor(store: StoreContext, cart: CartView, limit = 4) {
  if (!store.features["F-57"] || !cart.items.length) return [];
  const m = await storeModels(store);
  const inCart = cart.items.map((i) => new Types.ObjectId(i.product));
  // Picks on the cart's products, and on the items inside bundles in the cart.
  const parts = cart.items.flatMap((i) => (i.bundle ?? []).map((b) => new Types.ObjectId(b.product)));
  const owners = await m.Product.find({ _id: { $in: [...inCart, ...parts] } }, { upsells: 1 }).lean();
  const picked = [...new Set(owners.flatMap((p) => (p.upsells ?? []).map(String)))].filter((id) => !cart.items.some((i) => i.product === id));
  const base = { ...visibleFilter(store.features), _id: { $nin: inCart } };
  let list = picked.length ? await m.Product.find({ ...base, _id: { $in: picked.map((x) => new Types.ObjectId(x)), $nin: inCart } }).limit(limit).lean() : [];
  if (list.length < limit) {
    const cats = [...new Set(cart.items.map((i) => i.category).filter(Boolean))];
    if (cats.length) {
      const more = await m.Product.find({ ...base, _id: { $nin: [...inCart, ...list.map((p) => p._id)] }, category: { $in: cats } })
        .sort({ ratingCount: -1, createdAt: -1 }).limit(limit - list.length).lean();
      list = [...list, ...more];
    }
  }
  if (list.length < limit) {
    // Still short: newest products the shopper hasn't added.
    const more = await m.Product.find({ ...base, _id: { $nin: [...inCart, ...parts, ...list.map((p) => p._id)] }, kind: { $ne: "giftcard" } })
      .sort({ createdAt: -1 }).limit(limit - list.length).lean();
    list = [...list, ...more];
  }
  return list;
}
