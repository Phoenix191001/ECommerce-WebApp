import { notFound } from "next/navigation";
import { formatMoney, requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { stockLines } from "@/lib/warehouses";
import { Badge, Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { PoItems } from "@/components/manage/ops-forms";
import { createPurchaseOrder, receivePurchaseOrder, setPurchaseOrderStatus } from "../../ops-actions";

export const metadata = { title: "Purchase orders" };
const input = inputCls.replaceAll("indigo", "emerald");
const TONE = { draft: "slate", ordered: "sky", received: "green", cancelled: "rose" } as const;

export default async function PurchaseOrders({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const user = await requireStaff(store, "catalog");
  if (!store.features["F-80"] || user.role === "seller") notFound();
  const m = await storeModels(store);
  const [pos, lines, whs] = await Promise.all([
    m.PurchaseOrder.find().sort({ createdAt: -1 }).limit(100).lean(),
    stockLines(m),
    store.features["F-47"] ? m.Warehouse.find({ active: true }).sort({ isDefault: -1, name: 1 }).lean() : Promise.resolve([]),
  ]);
  const fm = (n: number) => formatMoney(n, store.currency);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📥 Purchase orders</h1>
        <p className="text-sm text-slate-500">Order stock from suppliers. When the goods arrive, receive them here and your stock goes up{store.features["F-82"] ? " and cost prices update" : ""}.</p>
      </div>
      <Card title="➕ New purchase order" accent="emerald">
        <ActionForm action={createPurchaseOrder.bind(null, site)} submit="Save purchase order" reset>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Supplier"><input name="supplier" required className={input} /></Field>
            <Field label="Phone"><input name="phone" className={input} /></Field>
            <Field label="Email"><input name="email" type="email" className={input} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {whs.length > 0 && <Field label="Deliver to"><select name="warehouse" className={input}>{whs.map((w) => <option key={String(w._id)} value={String(w._id)}>{w.name}</option>)}</select></Field>}
            <Field label="Expected on"><input name="expectedAt" type="date" className={input} /></Field>
          </div>
          <PoItems lines={lines.map((l) => ({ key: l.key, name: l.name }))} />
          <Field label="Note"><textarea name="note" rows={2} className={input} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="send" value="1" defaultChecked /> Mark as ordered (sent to the supplier)</label>
        </ActionForm>
      </Card>
      {pos.map((po) => {
        const total = po.items.reduce((n, i) => n + i.qty * i.cost, 0);
        const open = po.status === "draft" || po.status === "ordered";
        return (
          <Card key={String(po._id)} accent={open ? "sky" : undefined}
            title={<span className="flex flex-wrap items-center gap-2">PO-{po.number} · {po.supplier.name} <Badge tone={TONE[po.status]}>{po.status}</Badge></span>}
            actions={open ? (
              <div className="flex gap-3">
                {po.status === "draft" && <form action={setPurchaseOrderStatus.bind(null, site, String(po._id), "ordered")}><button className="text-xs font-semibold text-sky-700 hover:underline">Mark ordered</button></form>}
                <form action={setPurchaseOrderStatus.bind(null, site, String(po._id), "cancelled")}><button className="text-xs text-rose-600 hover:underline">Cancel</button></form>
              </div>
            ) : undefined}>
            <p className="mb-2 text-xs text-slate-500">
              {new Date(po.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}
              {po.supplier.phone && ` · ${po.supplier.phone}`}{po.supplier.email && ` · ${po.supplier.email}`}
              {po.expectedAt && ` · expected ${new Date(po.expectedAt).toLocaleDateString("en-GB")}`}
              {po.receivedAt && ` · received ${new Date(po.receivedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}`}
              {` · total ${fm(total)}`}
            </p>
            {open ? (
              <ActionForm action={receivePurchaseOrder.bind(null, site, String(po._id))} submit="📥 Receive these" className="space-y-2 text-sm">
                {po.items.map((it, i) => (
                  <label key={i} className="flex items-center justify-between gap-2">
                    <span>{it.name} <span className="text-xs text-slate-500">· {it.received}/{it.qty} received · {fm(it.cost)} each</span></span>
                    <input name={`recv_${i}`} type="number" min={0} max={it.qty - it.received} defaultValue={it.qty - it.received} className={`${input} !w-20 !py-1`} aria-label={`Received ${it.name}`} />
                  </label>
                ))}
              </ActionForm>
            ) : (
              <ul className="text-sm">{po.items.map((it, i) => <li key={i}>{it.name} × {it.qty} <span className="text-slate-500">({it.received} received)</span></li>)}</ul>
            )}
            {po.note && <p className="mt-2 text-xs text-slate-600">📝 {po.note}</p>}
          </Card>
        );
      })}
    </>
  );
}
