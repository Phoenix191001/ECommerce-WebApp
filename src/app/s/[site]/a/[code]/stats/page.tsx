import { notFound } from "next/navigation";
import { formatMoney, requireStore, storeModels } from "@/lib/tenant";
import { affiliateTotals } from "@/lib/affiliates";

export const metadata = { title: "Affiliate stats", robots: { index: false } };

// F-71: an affiliate's own numbers, behind a private key from the store owner.
export default async function AffiliateStats({ params, searchParams }: { params: Promise<{ site: string; code: string }>; searchParams: Promise<{ k?: string }> }) {
  const { site, code } = await params;
  const { k } = await searchParams;
  const store = await requireStore(site);
  if (!store.features["F-71"]) notFound();
  const m = await storeModels(store);
  const a = await m.Affiliate.findOne({ code: decodeURIComponent(code).toUpperCase() }).lean();
  if (!a || !k || k !== a.statsKey) notFound();
  const t = (await affiliateTotals(m)).get(a.code);
  const fm = (n: number) => formatMoney(n, store.currency);
  const recent = await m.Order.find({ affiliate: a.code }, { number: 1, createdAt: 1, status: 1, commission: 1, commissionPaid: 1 }).sort({ createdAt: -1 }).limit(30).lean();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">🤝 {a.name} · {store.name}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Clicks", a.clicks], ["Orders", t?.orders ?? 0], ["Earned", fm(t?.earned ?? 0)], ["To be paid", fm(t?.unpaid ?? 0)]].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs uppercase text-slate-500">{l}</p><p className="text-xl font-bold">{v}</p></div>
        ))}
      </div>
      <p className="text-sm text-slate-600">Commission: {a.rate}% of each order&apos;s items. Paid once the order is delivered.</p>
      <ul className="divide-y divide-slate-100 rounded-2xl bg-white p-2 text-sm shadow-sm">
        {recent.map((o) => (
          <li key={o.number} className="flex justify-between p-2">
            <span>{new Date(o.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })} · {o.status}</span>
            <span>{fm(o.commission)} {o.commissionPaid ? "✅ paid" : ""}</span>
          </li>
        ))}
        {!recent.length && <li className="p-2 text-slate-500">No orders yet.</li>}
      </ul>
    </main>
  );
}
