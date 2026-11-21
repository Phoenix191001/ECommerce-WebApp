import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { defaultWarehouse, stockLines } from "@/lib/warehouses";
import { Badge, Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { addWarehouse, countStock, moveStock, renameWarehouse } from "../../ops-actions";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Warehouses" };
const input = inputCls.replaceAll("indigo", "emerald");

export default async function Warehouses({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string }> }) {
  const { site } = await params;
  const { q } = await searchParams;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  const user = await requireStaff(store, "catalog");
  if (!store.features["F-47"] || user.role === "seller") notFound();
  const m = await storeModels(store);
  const main = await defaultWarehouse(m);
  const [whs, lines, rows, moves] = await Promise.all([
    m.Warehouse.find().sort({ isDefault: -1, name: 1 }).lean(),
    stockLines(m),
    m.WarehouseStock.find({ qty: { $ne: 0 } }).lean(),
    m.StockMove.find().sort({ createdAt: -1 }).limit(25).lean(),
  ]);
  const at = new Map(rows.map((r) => [`${r.product}:${r.variant ?? ""}:${r.warehouse}`, r.qty]));
  const shown = lines.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 150);
  const name = new Map(whs.map((w) => [String(w._id), w.name]));
  const qtyAt = (l: (typeof lines)[number], w: string) => {
    if (w !== String(main._id)) return at.get(`${l.product}:${l.variant ?? ""}:${w}`) ?? 0;
    return l.total - whs.filter((x) => !x.isDefault).reduce((n, x) => n + (at.get(`${l.product}:${l.variant ?? ""}:${x._id}`) ?? 0), 0);
  };
  const options = (
    <>
      <option value="">{T("Choose a product…")}</option>
      {lines.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
    </>
  );
  const whOptions = whs.map((w) => <option key={String(w._id)} value={String(w._id)}>{w.name}</option>);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{T("🏭 Warehouses and stock")}</h1>
        <p className="text-sm text-slate-500">{T("Your store sells from its total stock.")} <b>{main.name}</b> is where online and POS sales are taken from; it holds whatever isn&apos;t at your other locations. Move stock there before it runs out.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={T("Locations")} accent="emerald">
          <ul className="space-y-3 text-sm">
            {whs.map((w) => (
              <li key={String(w._id)}>
                <details>
                  <summary className="cursor-pointer"><b>{w.name}</b> {w.isDefault && <Badge tone="green">{T("sells from here")}</Badge>} <span className="text-slate-500">{w.address}</span></summary>
                  <ActionForm action={renameWarehouse.bind(null, site, String(w._id))} submit={T("Save")} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label={T("Name")}><input name="name" defaultValue={w.name} className={input} /></Field>
                    <Field label={T("Address")}><input name="address" defaultValue={w.address} className={input} /></Field>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ActionForm action={addWarehouse.bind(null, site)} submit={T("➕ Add location")} reset className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label={T("New location")}><input name="name" placeholder={T("Lahore godown")} className={input} /></Field>
              <Field label={T("Address")}><input name="address" className={input} /></Field>
            </ActionForm>
          </div>
        </Card>
        <div className="space-y-6">
          {store.features["F-81"] && (
            <Card title={T("🔁 Move stock")} accent="sky">
              <ActionForm action={moveStock.bind(null, site)} submit={T("Move")} reset>
                <Field label={T("Product")}><select name="product" required className={input}>{options}</select></Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label={T("From")}><select name="from" required className={input}>{whOptions}</select></Field>
                  <Field label={T("To")}><select name="to" required defaultValue={String(whs.find((w) => !w.isDefault)?._id ?? "")} className={input}>{whOptions}</select></Field>
                  <Field label={T("Qty")}><input name="qty" type="number" min="1" required className={input} /></Field>
                </div>
                <Field label={T("Note")}><input name="note" className={input} placeholder={T("Optional")} /></Field>
              </ActionForm>
            </Card>
          )}
          <Card title={T("📋 Stock count")} accent="amber">
            <ActionForm action={countStock.bind(null, site)} submit={T("Save count")} reset>
              <Field label={T("Product")}><select name="product" required className={input}>{options}</select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={T("Warehouse")}><select name="warehouse" required className={input}>{whOptions}</select></Field>
                <Field label={T("Counted on the shelf")}><input name="qty" type="number" min="0" required className={input} /></Field>
              </div>
              <p className="text-xs text-slate-500">{T("The difference is added to or taken from your total stock.")}</p>
            </ActionForm>
          </Card>
        </div>
      </div>
      <Card title={T("Stock by location")} accent="violet">
        <form className="mb-3"><input name="q" defaultValue={q} placeholder={T("Search products…")} className={`${input} max-w-xs`} /></form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 text-start">{T("Product")}</th>{whs.map((w) => <th key={String(w._id)} className="text-end">{w.name}</th>)}<th className="text-end">{T("Total")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((l) => (
                <tr key={l.key}>
                  <td className="py-2">{l.name}</td>
                  {whs.map((w) => { const n = qtyAt(l, String(w._id)); return <td key={String(w._id)} className={`text-end ${n < 0 ? "font-semibold text-rose-600" : ""}`}>{n}</td>; })}
                  <td className="text-end font-semibold">{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.some((l) => qtyAt(l, String(main._id)) < 0) && <p className="mt-2 text-xs text-rose-600">A red number at {main.name} means sales took more than it holds. Move stock there from another location.</p>}
      </Card>
      <Card title={T("Recent stock moves")} accent="sky">
        {moves.length === 0 ? <p className="text-sm text-slate-500">{T("No moves yet.")}</p> : (
          <ul className="space-y-1 text-sm">
            {moves.map((mv) => (
              <li key={String(mv._id)}>
                <span className="text-xs text-slate-500">{new Date(mv.createdAt!).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" })}</span>{" "}
                {mv.kind === "transfer" ? "🔁" : mv.kind === "receive" ? "📥" : "📋"} {mv.name}: {mv.kind === "transfer" ? `${mv.qty} from ${name.get(String(mv.from)) ?? "?"} to ${name.get(String(mv.to)) ?? "?"}` : `${mv.qty > 0 ? "+" : ""}${mv.qty} at ${name.get(String(mv.to ?? mv.from)) ?? "?"}`}
                <span className="text-xs text-slate-500"> · {mv.by}{mv.note ? ` · ${mv.note}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export const dynamic = "force-dynamic";
