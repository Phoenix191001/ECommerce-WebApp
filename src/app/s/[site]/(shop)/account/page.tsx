import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { STATUS_LABEL } from "@/lib/order-view";
import { logoutStore, toggleWishlist } from "../../shop-actions";

export const metadata = { title: "My account" };

export default async function AccountPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  // Turning F-22 off hides account pages and blocks account calls; orders stay readable by staff (SRS 6.3).
  if (!store.features["F-22"]) notFound();
  const user = await getCurrentUser(store);
  if (!user || user.role !== "customer") redirect(`${store.base}/account/login`);
  const m = await storeModels(store);
  const [orders, wish] = await Promise.all([
    m.Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    store.features["F-10"] && user.wishlist.length ? m.Product.find({ _id: { $in: user.wishlist }, status: "active" }).lean() : Promise.resolve([]),
  ]);
  const b = store.base;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="bg-brand-gradient flex flex-wrap items-center justify-between gap-3 rounded-3xl p-6 text-white">
        <div>
          <p className="text-sm text-white/80">Signed in as</p>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-white/80">{user.email}</p>
        </div>
        <form action={logoutStore.bind(null, site, "")}><button className="rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/30">Sign out</button></form>
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">My orders</h2>
        {orders.length === 0 ? <p className="text-sm text-slate-500">No orders yet. <Link href={b || "/"} className="text-brand underline">Start shopping</Link></p> : (
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => (
              <li key={o.number} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <Link href={`${b}/order/${o.number}`} className="font-semibold hover:underline">#{o.number}</Link>
                <span className="text-slate-500">{new Date(o.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span>
                <span className="bg-brand-soft rounded-full px-2 py-0.5 text-xs font-medium">{STATUS_LABEL[o.status]}</span>
                <span className="font-medium">{formatMoney(o.total, store.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {store.features["F-10"] && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">💖 Wishlist</h2>
          {wish.length === 0 ? <p className="text-sm text-slate-500">Save products you love and they'll show up here.</p> : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {wish.map((p) => (
                <li key={String(p._id)} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <Link href={`${b}/p/${p.slug}`} className="font-medium hover:underline">{p.name}</Link>
                  <p className="text-brand">{formatMoney(p.price, store.currency)}</p>
                  <form action={toggleWishlist.bind(null, site, String(p._id))}><button className="mt-1 text-xs text-rose-600 hover:underline">Remove</button></form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
