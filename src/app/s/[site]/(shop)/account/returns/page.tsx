import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { ReturnForm } from "@/components/store/extras";
import { AccountNav } from "../account-nav";

export const metadata = { title: "Returns" };

export default async function Returns({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ order?: string }> }) {
  const { site } = await params;
  const { order } = await searchParams;
  const store = await requireStore(site);
  const f = store.features;
  if (!f["F-22"] || !f["F-46"]) notFound();
  const user = await getCurrentUser(store);
  if (!user || user.role !== "customer") redirect(`${store.base}/account/login`);
  const m = await storeModels(store);
  const [mine, delivered] = await Promise.all([
    m.Return.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
    m.Order.find({ user: user._id, status: "delivered" }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const chosen = delivered.find((o) => String(o.number) === order);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">↩️ Returns and exchanges</h1>
      <AccountNav store={store} active="returns" />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Start a return</h2>
        {delivered.length === 0 ? <p className="text-sm text-slate-500">You can return items from delivered orders.</p> : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {delivered.map((o) => (
                <Link key={o.number} href={`?order=${o.number}`} className={`rounded-full px-3 py-1 text-sm ${chosen?.number === o.number ? "bg-brand text-white" : "bg-slate-100"}`}>#{o.number}</Link>
              ))}
            </div>
            {chosen ? (
              <ReturnForm site={site} order={chosen.number} items={chosen.items.map((i) => ({ name: i.variantName ? `${i.name} (${i.variantName})` : i.name, qty: i.qty }))} allowExchange={!!f["F-100"]} allowCredit={!!f["F-56"]} />
            ) : <p className="text-sm text-slate-500">Choose an order above.</p>}
          </>
        )}
      </section>
      {mine.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">My requests</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {mine.map((r) => (
              <li key={String(r._id)} className="py-2">
                <b>Order #{r.orderNumber}</b> · {r.type} · <span className="bg-brand-soft rounded-full px-2 py-0.5 text-xs font-medium capitalize">{r.status}</span>
                <p className="text-slate-600">{r.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
                {r.note && <p className="text-xs text-slate-500">Store note: {r.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
