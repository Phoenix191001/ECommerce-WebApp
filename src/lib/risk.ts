import "server-only";
import type { TenantModels } from "./models/tenant";

/** F-106: simple, explainable fraud signals for cash-on-delivery orders. 0–100; 50+ is flagged. */
export async function scoreOrder(
  m: TenantModels,
  o: { total: number; email: string; phone: string; address: string; signedIn: boolean },
) {
  const reasons: string[] = [];
  let score = 0;
  const [typical, recentSamePhone, cancelledBefore] = await Promise.all([
    m.Order.aggregate<{ avg: number }>([{ $match: { status: { $nin: ["cancelled"] } } }, { $group: { _id: null, avg: { $avg: "$total" } } }]),
    m.Order.countDocuments({ "customer.phone": o.phone, createdAt: { $gte: new Date(Date.now() - 24 * 3600_000) } }),
    m.Order.countDocuments({ $or: [{ "customer.phone": o.phone }, { "customer.email": o.email }], status: "cancelled" }),
  ]);
  const avg = typical[0]?.avg ?? 0;
  if (avg > 0 && o.total > avg * 4) { score += 30; reasons.push("Much larger than a typical order"); }
  if (recentSamePhone >= 3) { score += 25; reasons.push(`${recentSamePhone} orders from this phone in 24 hours`); }
  if (cancelledBefore > 0) { score += 25; reasons.push(`${cancelledBefore} cancelled order(s) before`); }
  if (!o.signedIn) { score += 10; reasons.push("Guest checkout"); }
  if (o.address && o.address.trim().length < 10) { score += 15; reasons.push("Very short address"); }
  if (/@(mailinator|guerrillamail|tempmail|10minutemail)\./i.test(o.email)) { score += 30; reasons.push("Disposable email"); }
  return { score: Math.min(100, score), reasons };
}
