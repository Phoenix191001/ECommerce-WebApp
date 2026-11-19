import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { sellerTotals } from "@/lib/marketplace";
import { Card, Stat } from "@/components/admin/ui";

export const metadata = { title: "My sales" };

// F-67: a seller's own dashboard.
export default async function SellerHome({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const user = await requireStaff(store, "catalog", { seller: true });
  if (user.role !== "seller" || !user.sellerId) notFound();
  const m = await storeModels(store);
  const [t] = await sellerTotals(m, user.sellerId);
  if (!t) notFound();
  const recent = await m.Order.find({ "items.seller": user.sellerId }).sort({ createdAt: -1 }).limit(10).lean();
  const fm = (n: number) => formatMoney(n, store.currency);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🏪 {t.seller.name}</h1>
        <p className="text-sm text-slate-500">You sell through {store.name}. They keep {t.seller.rate}% of delivered sales and pay you the rest.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Delivered sales" value={fm(t.gross)} tone="emerald" icon="💰" />
        <Stat label="Your share" value={fm(t.earned)} tone="sky" icon="🧾" />
        <Stat label="Paid to you" value={fm(t.paid)} tone="violet" icon="🏦" />
        <Stat label="Owed to you" value={fm(t.owed)} tone="amber" icon="⏳" />
      </div>
      <Card title="Recent orders with your products" accent="sky" actions={<Link href={`${store.base}/manage/orders`} className="text-sm text-emerald-700 hover:underline">All →</Link>}>
        {recent.length === 0 ? <p className="text-sm text-slate-500">No orders yet. <Link href={`${store.base}/manage/products/new`} className="text-emerald-700 underline">Add a product</Link>.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((o) => {
              const mine = o.items.filter((i) => String(i.seller) === String(user.sellerId));
              return (
                <li key={o.number} className="flex justify-between gap-2 py-2">
                  <Link href={`${store.base}/manage/orders/${o.number}`} className="font-semibold hover:underline">#{o.number}</Link>
                  <span className="flex-1 truncate text-slate-600">{mine.map((i) => `${i.name} × ${i.qty}`).join(", ")}</span>
                  <span className="text-slate-500">{o.status}</span>
                  <span className="font-medium">{fm(mine.reduce((n, i) => n + i.price * i.qty, 0))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {t.seller.payouts.length > 0 && (
        <Card title="Payouts" accent="violet">
          <ul className="text-sm">{t.seller.payouts.slice().reverse().map((p, i) => <li key={i}>{new Date(p.at).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })} · {fm(p.amount)} {p.note && `· ${p.note}`}</li>)}</ul>
        </Card>
      )}
    </>
  );
}
