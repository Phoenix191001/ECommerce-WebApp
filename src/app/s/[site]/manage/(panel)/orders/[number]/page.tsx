import Link from "next/link";
import { notFound } from "next/navigation";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { STATUS_LABEL } from "@/lib/order-view";
import type { OrderStatus } from "@/lib/models/tenant";
import { Badge, Card, STATUS_TONE, btnTealCls, btnSecondaryCls } from "@/components/admin/ui";
import { RefundForm } from "@/components/manage/forms";
import { EditOrderForm } from "@/components/manage/ops-forms";
import { decidePendingRefund, setOrderStatus } from "../../../manage-actions";

export const metadata = { title: "Order" };

const ACTIONS: Record<string, { to: OrderStatus; label: string; primary?: boolean }[]> = {
  pending: [{ to: "confirmed", label: "✅ Confirm order", primary: true }, { to: "cancelled", label: "Cancel" }],
  confirmed: [{ to: "shipped", label: "🚚 Mark shipped", primary: true }, { to: "cancelled", label: "Cancel" }],
  shipped: [{ to: "delivered", label: "📬 Mark delivered", primary: true }],
};

export default async function OrderDetail({ params }: { params: Promise<{ site: string; number: string }> }) {
  const { site, number } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "orders");
  const m = await storeModels(store);
  const o = await m.Order.findOne({ number: Number(number) }).lean();
  if (!o) notFound();
  const fm = (n: number) => formatMoney(n, store.currency);
  const refunded = o.refunds.reduce((n, r) => n + r.amount, 0);
  const canRefund = o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`${store.base}/manage/orders`} className="text-sm text-slate-500 hover:underline">← Orders</Link>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">Order #{o.number} <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></h1>
          <p className="text-sm text-slate-500">{new Date(o.createdAt!).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} · {o.channel === "pos" ? "Point of sale" : "Online"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(ACTIONS[o.status] ?? []).map((a) => (
            <form key={a.to} action={setOrderStatus.bind(null, site, o.number, a.to)}>
              <button className={a.primary ? btnTealCls : btnSecondaryCls}>{a.label}</button>
            </form>
          ))}
          {store.features["F-52"] && <a href={`${store.base}/order/${o.number}/invoice`} target="_blank" className={btnSecondaryCls}>🧾 Invoice</a>}
          {store.features["F-83"] && <a href={`${store.base}/manage/orders/${o.number}/packing`} target="_blank" className={btnSecondaryCls}>📦 Packing slip</a>}
        </div>
      </div>
      {store.features["F-106"] && o.riskScore >= 50 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <b>⚠️ Fraud risk {o.riskScore}/100.</b> Call the customer to confirm before shipping. {o.riskReasons.join(" · ")}
        </div>
      )}
      {o.pendingRefunds.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Refunds waiting for a second approver</b>
          {o.pendingRefunds.map((r) => (
            <div key={String(r._id)} className="flex flex-wrap items-center gap-2">
              <span>{fm(r.amount)} · {r.reason || "no reason"} · requested by {r.requestedBy}</span>
              <form action={decidePendingRefund.bind(null, site, o.number, String(r._id), true)}><button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Approve</button></form>
              <form action={decidePendingRefund.bind(null, site, o.number, String(r._id), false)}><button className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">Reject</button></form>
            </div>
          ))}
          <p className="text-xs">The person who requested a refund can&apos;t approve it.</p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title="Items" accent="emerald">
          <ul className="divide-y divide-slate-100 text-sm">
            {o.items.map((i) => <li key={`${i.product}:${i.variant ?? ""}`} className="flex justify-between py-2"><span>{i.name}{i.variantName ? ` (${i.variantName})` : ""} × {i.qty}</span><span>{fm(i.price * i.qty)}</span></li>)}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{fm(o.subtotal)}</dd></div>
            {o.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount {o.discountCode}</dt><dd>−{fm(o.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Delivery</dt><dd>{fm(o.shipping)}</dd></div>
            {o.tax > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{fm(o.tax)}</dd></div>}
            {o.giftWrapFee > 0 && <div className="flex justify-between"><dt>🎁 Gift wrap</dt><dd>{fm(o.giftWrapFee)}</dd></div>}
            {o.pointsDiscount > 0 && <div className="flex justify-between text-emerald-700"><dt>⭐ Points ({o.pointsRedeemed})</dt><dd>−{fm(o.pointsDiscount)}</dd></div>}
            {o.creditUsed > 0 && <div className="flex justify-between text-emerald-700"><dt>💳 Store credit</dt><dd>−{fm(o.creditUsed)}</dd></div>}
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{fm(o.total)}</dd></div>
            {refunded > 0 && <div className="flex justify-between text-rose-600"><dt>Refunded</dt><dd>−{fm(refunded)}</dd></div>}
          </dl>
          {o.note && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">📝 {o.note}</p>}
        </Card>
        <div className="space-y-6">
          <Card title="Customer" accent="sky">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{o.customer.name || "Walk-in customer"}</p>
              {o.customer.phone && <p><a href={`tel:${o.customer.phone}`} className="text-emerald-700">{o.customer.phone}</a></p>}
              {o.customer.email && <p className="text-slate-600">{o.customer.email}</p>}
              <p className="text-slate-600">{o.delivery === "pickup" ? "🏬 Pickup" : o.customer.address ? `🚚 ${o.customer.address}, ${o.customer.city}` : ""}</p>
              {o.deliverySlot && <p className="text-slate-600">🕒 {o.deliverySlot}</p>}
              {o.giftWrap && <p className="text-slate-600">🎁 Gift wrap{o.giftMessage ? `: “${o.giftMessage}”` : ""}</p>}
              <p className="pt-2"><Badge tone={STATUS_TONE[o.paymentStatus]}>{o.paymentMethod.toUpperCase()} · {o.paymentStatus.replace("_", " ")}</Badge></p>
            </div>
          </Card>
          <Card title="Timeline" accent="violet">
            <ol className="space-y-2 border-l-2 border-emerald-200 pl-4 text-sm">
              {o.history.map((h, i) => (
                <li key={i}><b>{STATUS_LABEL[h.status] ?? h.status}</b> <span className="text-xs text-slate-500">{new Date(h.at).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}{h.by ? ` · ${h.by}` : ""}</span>{h.note && <p className="text-xs text-slate-600">{h.note}</p>}</li>
              ))}
            </ol>
          </Card>
          {store.features["F-98"] && o.channel === "online" && ["pending", "confirmed"].includes(o.status) && (
            <Card title="✏️ Edit order" accent="amber">
              <EditOrderForm site={site} number={o.number} items={o.items.map((i) => ({ name: i.variantName ? `${i.name} (${i.variantName})` : i.name, qty: i.qty }))} />
            </Card>
          )}
          {canRefund && o.total - refunded > 0 && (
            <Card title="Refund" accent="rose"><RefundForm site={site} number={o.number} max={o.total - refunded} /></Card>
          )}
        </div>
      </div>
    </>
  );
}
