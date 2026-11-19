import "server-only";
import type { Types } from "mongoose";
import type { TenantModels } from "./models/tenant";

/** F-67: each seller's delivered sales, the store's commission and what is still owed to them. */
export async function sellerTotals(m: TenantModels, only?: Types.ObjectId) {
  const [rows, sellers] = await Promise.all([
    m.Order.aggregate<{ _id: Types.ObjectId; gross: number; units: number; orders: number }>([
      { $match: { status: "delivered", "items.seller": only ?? { $exists: true } } },
      { $unwind: "$items" },
      { $match: { "items.seller": only ?? { $exists: true, $ne: null } } },
      { $group: { _id: "$items.seller", gross: { $sum: { $multiply: ["$items.price", "$items.qty"] } }, units: { $sum: "$items.qty" }, orders: { $addToSet: "$number" } } },
      { $project: { gross: 1, units: 1, orders: { $size: "$orders" } } },
    ]),
    m.Seller.find(only ? { _id: only } : {}).lean(),
  ]);
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  return sellers.map((s) => {
    const r = byId.get(String(s._id));
    const gross = r?.gross ?? 0;
    const commission = Math.round((gross * s.rate) / 100);
    const paid = s.payouts.reduce((n, p) => n + p.amount, 0);
    return { seller: s, gross, units: r?.units ?? 0, orders: r?.orders ?? 0, commission, earned: gross - commission, paid, owed: gross - commission - paid };
  });
}
