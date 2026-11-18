import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStore, storeModels, formatMoney } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { storePrefs } from "@/lib/store-prefs";
import { fill, statusText } from "@/lib/i18n";
import { storeUrl } from "@/lib/subdomain";
import { logoutStore, toggleWishlist } from "../../shop-actions";
import { AccountNav } from "./account-nav";

export const metadata = { title: "My account" };

export default async function AccountPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const f = store.features;
  // Turning F-22 off hides account pages and blocks account calls; orders stay readable by staff (SRS 6.3).
  if (!f["F-22"]) notFound();
  const user = await getCurrentUser(store);
  if (!user || user.role !== "customer") redirect(`${store.base}/account/login`);
  const { t: L } = await storePrefs(store);
  const m = await storeModels(store);
  const [orders, wish] = await Promise.all([
    m.Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    f["F-10"] && user.wishlist.length ? m.Product.find({ _id: { $in: user.wishlist }, status: "active" }).lean() : Promise.resolve([]),
  ]);
  const b = store.base;
  const fm = (n: number) => formatMoney(n, store.currency);
  const refLink = user.referralCode ? `${storeUrl(store.subdomain)}/account/register?ref=${user.referralCode}` : "";
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="bg-brand-gradient flex flex-wrap items-center justify-between gap-3 rounded-3xl p-6 text-white">
        <div>
          <p className="text-sm text-white/80">{L.signedInAs}</p>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-white/80">{user.email}</p>
        </div>
        <form action={logoutStore.bind(null, site, "")}><button className="rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/30">{L.signOut}</button></form>
      </div>
      <AccountNav store={store} active="home" L={L} />
      {(f["F-28"] || f["F-56"] || (f["F-70"] && user.referralCode)) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {f["F-28"] && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">{L.loyaltyPoints}</p>
              <p className="text-2xl font-bold">{user.loyaltyPoints ?? 0}</p>
              <p className="text-xs text-slate-500">{fill(L.pointsWorth, { amount: fm(Math.floor((user.loyaltyPoints ?? 0) * store.settings.pointValue)), per: fm(store.settings.pointsPer) })}</p>
            </div>
          )}
          {f["F-56"] && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">💳 {L.storeCredit}</p>
              <p className="text-2xl font-bold">{fm(user.storeCredit ?? 0)}</p>
              <p className="text-xs text-slate-500">{L.useAtCheckout}</p>
            </div>
          )}
          {f["F-70"] && user.referralCode && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">{L.referFriend}</p>
              <p className="font-mono text-xl font-bold tracking-widest text-brand">{user.referralCode}</p>
              <p className="text-xs text-slate-500">{fill(L.referRule, { amount: fm(store.settings.referralReward) })}</p>
              <p className="mt-1 break-all text-[11px] text-slate-400">{refLink}</p>
            </div>
          )}
        </div>
      )}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{L.myOrders}</h2>
        {orders.length === 0 ? <p className="text-sm text-slate-500">{L.noOrders} <Link href={b || "/"} className="text-brand underline">{L.startShopping}</Link></p> : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => (
              <li key={o.number} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <Link href={`${b}/order/${o.number}`} className="font-semibold hover:underline">#{o.number}</Link>
                <span className="text-slate-500">{new Date(o.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span>
                <span className="bg-brand-soft rounded-full px-2 py-0.5 text-xs font-medium">{statusText(L, o.status)}</span>
                <span className="font-medium">{fm(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {f["F-10"] && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">{L.wishlist}</h2>
          {wish.length === 0 ? <p className="text-sm text-slate-500">{L.wishlistEmpty}</p> : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {wish.map((p) => (
                <li key={String(p._id)} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <Link href={`${b}/p/${p.slug}`} className="font-medium hover:underline">{p.name}</Link>
                  <p className="text-brand">{fm(p.price)}</p>
                  <form action={toggleWishlist.bind(null, site, String(p._id))}><button className="mt-1 text-xs text-rose-600 hover:underline">{L.remove}</button></form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {f["F-56"] && (user.creditHistory?.length ?? 0) > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">{L.creditHistory}</h2>
          <ul className="space-y-1 text-sm">
            {[...user.creditHistory].reverse().slice(0, 20).map((h, i) => (
              <li key={i} className="flex justify-between"><span>{h.reason} <span className="text-xs text-slate-400">{new Date(h.at).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span></span><span className={h.amount < 0 ? "text-rose-600" : "text-emerald-700"}>{h.amount > 0 ? "+" : ""}{fm(h.amount)}</span></li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
