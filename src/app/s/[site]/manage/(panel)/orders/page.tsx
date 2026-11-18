import Link from "next/link";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { STATUS_LABEL } from "@/lib/order-view";
import { Badge, Card, STATUS_TONE } from "@/components/admin/ui";

export const metadata = { title: "Orders" };

const TABS = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];

export default async function Orders({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { site } = await params;
  const { status = "all", q } = await searchParams;
  const store = await requireStore(site);
  await requireStaff(store, "orders");
  const m = await storeModels(store);
  const filter: Record<string, unknown> = {};
  if (status !== "all" && TABS.includes(status)) filter.status = status;
  if (q) {
    const n = Number(q.replace(/\D/g, ""));
    filter.$or = [{ "customer.email": q.toLowerCase().trim() }, { "customer.phone": q.trim() }, ...(n ? [{ number: n }] : [])];
  }
  const [orders, counts] = await Promise.all([
    m.Order.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
    m.Order.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const cnt = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const b = `${store.base}/manage`;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        {store.features["F-50"] && <a href={`${b}/export/orders`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">⬇️ Export CSV</a>}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t} href={`${b}/orders${t === "all" ? "" : `?status=${t}`}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${status === t ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
            {t === "all" ? "All" : STATUS_LABEL[t]} {t !== "all" && cnt[t] ? <span className="opacity-70">({cnt[t]})</span> : null}
          </Link>
        ))}
      </div>
      <Card>
        <form className="mb-4"><input name="q" defaultValue={q} placeholder="Order number, email, or phone…" className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" /></form>
        {orders.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No orders here yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Order</th><th>Date</th><th>Customer</th><th>Channel</th><th>Payment</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.number} className="hover:bg-slate-50">
                    <td className="py-2.5"><Link href={`${b}/orders/${o.number}`} className="font-semibold text-emerald-700 hover:underline">#{o.number}</Link></td>
                    <td className="text-slate-600">{new Date(o.createdAt!).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" })}</td>
                    <td>{o.customer.name || "Walk-in"}</td>
                    <td><Badge tone={o.channel === "pos" ? "violet" : "sky"}>{o.channel === "pos" ? "POS" : "Online"}</Badge></td>
                    <td><Badge tone={STATUS_TONE[o.paymentStatus]}>{o.paymentStatus.replace("_", " ")}</Badge></td>
                    <td><Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                    <td className="text-right font-medium">{formatMoney(o.total, store.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
