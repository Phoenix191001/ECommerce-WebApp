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

/**
 * F-108: birthday (in the birthday month) and account-anniversary points, given once a year
 * when the customer next visits their account. Returns what was given, to show a message.
 */
export async function celebrate(store: StoreContext, m: TenantModels, user: { _id: unknown; birthday?: string; createdAt?: Date; rewardsGiven?: string[] }) {
  if (!store.features["F-108"] || !store.features["F-28"]) return [];
  const now = new Date(Date.now() + 5 * 3600_000); // Pakistan time
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const given = new Set(user.rewardsGiven ?? []);
  const out: { kind: "birthday" | "anniversary"; points: number }[] = [];
  if (user.birthday && Number(user.birthday.slice(0, 2)) === month && store.settings.birthdayPoints > 0 && !given.has(`birthday-${year}`))
    out.push({ kind: "birthday", points: store.settings.birthdayPoints });
  if (user.createdAt && store.settings.anniversaryPoints > 0) {
    const c = new Date(new Date(user.createdAt).getTime() + 5 * 3600_000);
    if (c.getUTCFullYear() < year && c.getUTCMonth() + 1 === month && !given.has(`anniversary-${year}`))
      out.push({ kind: "anniversary", points: store.settings.anniversaryPoints });
  }
  const done: typeof out = [];
  for (const r of out) {
    // The rewardsGiven check makes this safe if two pages load at once.
    const res = await m.User.updateOne({ _id: user._id, rewardsGiven: { $ne: `${r.kind}-${year}` } }, { $inc: { loyaltyPoints: r.points }, $push: { rewardsGiven: `${r.kind}-${year}` } });
    if (res.modifiedCount) done.push(r);
  }
  return done;
}
