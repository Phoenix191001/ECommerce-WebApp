import Link from "next/link";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { dateLocale } from "@/lib/languages";
import { panelPrefs, pStatus, pText } from "@/lib/panel-i18n";
import { Badge, Card, STATUS_TONE } from "@/components/admin/ui";

export const metadata = { title: "Orders" };

const TABS = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];

export default async function Orders({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { site } = await params;
  const { status = "all", q } = await searchParams;
  const store = await requireStore(site);
  const user = await requireStaff(store, "orders", { seller: true });
  const seller = user.role === "seller" ? user.sellerId : undefined;
  const m = await storeModels(store);
  const filter: Record<string, unknown> = seller ? { "items.seller": seller } : {};
  if (status !== "all" && TABS.includes(status)) filter.status = status;
  if (q) {
    const n = Number(q.replace(/\D/g, ""));
    filter.$or = [{ "customer.email": q.toLowerCase().trim() }, { "customer.phone": q.trim() }, ...(n ? [{ number: n }] : [])];
  }
  const [orders, counts] = await Promise.all([
    m.Order.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
    m.Order.aggregate<{ _id: string; n: number }>([...(seller ? [{ $match: { "items.seller": seller } }] : []), { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const cnt = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const b = `${store.base}/manage`;
  const { p, lang, t: T } = await panelPrefs(store);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{p.orders}</h1>
        {store.features["F-50"] && !seller && <a href={`${b}/export/orders`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">{p.exportCsv}</a>}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t} href={`${b}/orders${t === "all" ? "" : `?status=${t}`}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${status === t ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
            {t === "all" ? p.all : pStatus(p, t)} {t !== "all" && cnt[t] ? <span className="opacity-70">({cnt[t]})</span> : null}
          </Link>
        ))}
      </div>
      <Card>
        <form className="mb-4"><input name="q" defaultValue={q} placeholder={p.searchOrders} className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" /></form>
        {orders.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{p.noOrdersHere}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 text-start">{p.colOrder}</th><th className="text-start">{p.colDate}</th><th className="text-start">{p.colCustomer}</th><th className="text-start">{p.colChannel}</th><th className="text-start">{p.colPayment}</th><th className="text-start">{p.colStatus}</th><th className="text-end">{p.colTotal}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.number} className="hover:bg-slate-50">
                    <td className="py-2.5"><Link href={`${b}/orders/${o.number}`} className="font-semibold text-emerald-700 hover:underline">#{o.number}</Link>{store.features["F-106"] && (o.riskScore ?? 0) >= 50 && <span title={(o.riskReasons ?? []).join(", ")} className="ms-1">⚠️</span>}{(o.pendingRefunds?.length ?? 0) > 0 && <span title={T("Refund waiting for approval")} className="ms-1">⏳</span>}</td>
                    <td className="text-slate-600">{new Date(o.createdAt!).toLocaleString(dateLocale(lang), { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" })}</td>
                    <td>{o.customer.name || p.walkIn}</td>
                    <td><Badge tone={o.channel === "pos" ? "violet" : "sky"}>{o.channel === "pos" ? "POS" : p.online}</Badge></td>
                    <td><Badge tone={STATUS_TONE[o.paymentStatus]}>{pText(p, "pay", o.paymentStatus)}</Badge></td>
                    <td><Badge tone={STATUS_TONE[o.status]}>{pStatus(p, o.status)}</Badge></td>
                    <td className="text-end font-medium">{formatMoney(seller ? o.items.filter((i) => String(i.seller) === String(seller)).reduce((n, i) => n + i.price * i.qty, 0) : o.total, store.currency)}</td>
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
