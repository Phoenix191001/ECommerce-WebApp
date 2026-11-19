import "server-only";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";

/** F-114 sales pop-up: the last week's online orders, as city + first product only. */
export async function recentSales(store: StoreContext) {
  const now = Date.now();
  const orders: { customer?: { city?: string }; items?: { name: string }[]; createdAt?: Date }[] = await (await storeModels(store)).Order.find(
    { channel: "online", status: { $nin: ["cancelled", "refunded"] }, createdAt: { $gte: new Date(now - 7 * 86400_000) } },
    { customer: 1, items: { $slice: 1 }, createdAt: 1 },
  ).sort({ createdAt: -1 }).limit(8).lean();
  return orders
    .map((o) => ({ city: (o.customer?.city ?? "").slice(0, 40), name: o.items?.[0]?.name ?? "", ago: Math.max(1, Math.round((now - new Date(o.createdAt!).getTime()) / 60000)) }))
    .filter((x) => x.name);
}
