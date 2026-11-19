import "server-only";
import { cookies } from "next/headers";
import type { Types } from "mongoose";
import type { TenantModels } from "./models/tenant";
import type { StoreContext } from "./tenant";

// F-71 affiliates: people share /a/<CODE>; orders within 30 days earn them a commission.

export const affCookie = (store: Pick<StoreContext, "id">) => `aff_${store.id}`;
export const AFF_DAYS = 30;

export async function affiliateForOrder(store: StoreContext, m: TenantModels, customer: Types.ObjectId | undefined, amount: number) {
  const code = (await cookies()).get(affCookie(store))?.value;
  if (!code || !/^[A-Z0-9-]{3,30}$/.test(code)) return null;
  const a = await m.Affiliate.findOne({ code, status: "active" }).lean();
  if (!a) return null;
  if (customer && a.user && String(a.user) === String(customer)) return null; // no commission on your own orders
  return { code: a.code, commission: Math.max(0, Math.round((amount * a.rate) / 100)) };
}

/** Commission earned, owed and paid per affiliate (cancelled and refunded orders don't count). */
export async function affiliateTotals(m: TenantModels) {
  const rows = await m.Order.aggregate<{ _id: string; orders: number; sales: number; earned: number; unpaid: number }>([
    { $match: { affiliate: { $exists: true, $ne: null }, status: { $nin: ["cancelled", "refunded"] } } },
    {
      $group: {
        _id: "$affiliate", orders: { $sum: 1 }, sales: { $sum: "$subtotal" }, earned: { $sum: "$commission" },
        unpaid: { $sum: { $cond: [{ $and: [{ $eq: ["$commissionPaid", false] }, { $eq: ["$status", "delivered"] }] }, "$commission", 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id, r]));
}
