import "server-only";
import type { StoreContext } from "./tenant";
import type { TenantModels } from "./models/tenant";
import type { CurrentUser } from "./store-auth";

/** Product list for bundle and upsell pickers, plus marketplace sellers (F-13, F-57, F-67). */
export async function editorExtras(store: StoreContext, m: TenantModels, user: CurrentUser) {
  const f = store.features;
  const own = user.role === "seller" ? { seller: user.sellerId } : {};
  const [products, sellers] = await Promise.all([
    f["F-13"] || f["F-57"] ? m.Product.find(own, { name: 1, variants: 1, bundle: 1 }).sort({ name: 1 }).limit(500).lean() : Promise.resolve([]),
    f["F-67"] && user.role !== "seller" ? m.Seller.find({ status: "active" }, { name: 1 }).sort({ name: 1 }).lean() : Promise.resolve([]),
  ]);
  return {
    catalog: products.map((p) => ({ id: String(p._id), name: p.name, simple: !p.variants?.length && !p.bundle?.length })),
    sellers: sellers.map((s) => ({ id: String(s._id), name: s.name })),
  };
}
