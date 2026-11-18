import "server-only";
import type { StoreContext } from "./tenant";
import type { TenantModels } from "./models/tenant";

/**
 * When an online order is delivered: award loyalty points (F-28) and, on a referred
 * customer's first delivered order, give both people store credit (F-70).
 */
export async function rewardDelivered(store: StoreContext, m: TenantModels, orderNumber: number) {
  const o = await m.Order.findOne({ number: orderNumber });
  if (!o || !o.user || o.status !== "delivered") return;
  const f = store.features;
  if (f["F-28"] && !o.pointsEarned) {
    const pts = Math.floor((o.total - o.shipping) / Math.max(1, store.settings.pointsPer));
    if (pts > 0) {
      o.pointsEarned = pts;
      await o.save();
      await m.User.updateOne({ _id: o.user }, { $inc: { loyaltyPoints: pts } });
    }
  }
  if (f["F-70"] && f["F-56"] && store.settings.referralReward > 0) {
    const u = await m.User.findById(o.user);
    if (u?.referredBy && !u.referralRewarded) {
      const amt = store.settings.referralReward;
      u.referralRewarded = true;
      u.storeCredit += amt;
      u.creditHistory.push({ amount: amt, reason: "Referral welcome reward", at: new Date() });
      await u.save();
      await m.User.updateOne(
        { _id: u.referredBy },
        { $inc: { storeCredit: amt }, $push: { creditHistory: { amount: amt, reason: `Referral reward: ${u.name}`, at: new Date() } } },
      );
    }
  }
}
