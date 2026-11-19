"use client";

import { useActionState, useState } from "react";
import { addExpense, editOrder, shipItems, type MState } from "@/app/s/[site]/manage/manage-actions";
import { KeepForm } from "@/components/keep-form";
import { Field, FormMessage, btnTealCls, inputCls } from "@/components/admin/ui";

const tealInput = inputCls.replaceAll("indigo", "emerald");

export function EditOrderForm({ site, number, items }: { site: string; number: number; items: { name: string; qty: number }[] }) {
  const [s, a, p] = useActionState<MState, FormData>(editOrder.bind(null, site, number), undefined);
  return (
    <KeepForm action={a} className="space-y-2 text-sm">
      {items.map((i, idx) => (
        <label key={idx} className="flex items-center justify-between gap-2">
          <span>{i.name}</span>
          <input name={`qty_${idx}`} type="number" min="0" max="999" defaultValue={i.qty} className={`${tealInput} !w-20 !py-1`} aria-label={`Quantity of ${i.name}`} />
        </label>
      ))}
      <p className="text-xs text-slate-500">Set a quantity to 0 to remove the item. Totals and stock update automatically.</p>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? "Saving…" : "Save changes"}</button>
    </KeepForm>
  );
}

export function ExpenseForm({ site, today }: { site: string; today: string }) {
  const [s, a, p] = useActionState<MState, FormData>(addExpense.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="grid gap-2 sm:grid-cols-5 sm:items-end">
      <Field label="Date"><input name="date" type="date" defaultValue={today} className={tealInput} /></Field>
      <Field label="Category">
        <select name="category" className={tealInput}>{["Rent", "Salaries", "Utilities", "Marketing", "Delivery", "Packaging", "Stock purchase", "Other"].map((c) => <option key={c}>{c}</option>)}</select>
      </Field>
      <Field label="Amount"><input name="amount" type="number" min="1" required className={tealInput} /></Field>
      <Field label="Note"><input name="note" className={tealInput} /></Field>
      <button className={btnTealCls} disabled={p}>Add</button>
      <div className="sm:col-span-5"><FormMessage state={s} /></div>
    </KeepForm>
  );
}

/** F-99: record a parcel with some of the order's items. */
export function ShipItemsForm({ site, number, items }: { site: string; number: number; items: { line: number; name: string; left: number }[] }) {
  const [s, a, p] = useActionState<MState, FormData>(shipItems.bind(null, site, number), undefined);
  return (
    <KeepForm action={a} className="space-y-2 text-sm">
      {items.map((i) => (
        <label key={i.line} className="flex items-center justify-between gap-2">
          <span>{i.name} <span className="text-xs text-slate-500">({i.left} left to ship)</span></span>
          <input name={`ship_${i.line}`} type="number" min="0" max={i.left} defaultValue={i.left} className={`${tealInput} !w-20 !py-1`} aria-label={`Ship how many ${i.name}`} />
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Courier"><input name="courier" className={tealInput} placeholder="TCS, Leopards…" /></Field>
        <Field label="Tracking number"><input name="tracking" className={tealInput} /></Field>
      </div>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? "Saving…" : "📦 Ship these items"}</button>
    </KeepForm>
  );
}

/** F-80: lines of a purchase order. Submits `items` as JSON. */
export function PoItems({ lines }: { lines: { key: string; name: string }[] }) {
  const [rows, setRows] = useState([{ key: "", qty: 1, cost: 0 }]);
  const set = (i: number, v: Partial<{ key: string; qty: number; cost: number }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <div className="space-y-2">
      <input type="hidden" name="items" value={JSON.stringify(rows.filter((r) => r.key))} />
      <div className="grid grid-cols-[1fr_5rem_7rem_2rem] gap-2 text-xs font-medium text-slate-500"><span>Product</span><span>Qty</span><span>Unit cost</span><span /></div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_5rem_7rem_2rem] gap-2">
          <select value={r.key} onChange={(e) => set(i, { key: e.target.value })} className={tealInput} aria-label={`Item ${i + 1}`}>
            <option value="">Choose…</option>
            {lines.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
          </select>
          <input type="number" min={1} value={r.qty} onChange={(e) => set(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className={tealInput} aria-label="Quantity" />
          <input type="number" min={0} value={r.cost} onChange={(e) => set(i, { cost: Math.max(0, Number(e.target.value) || 0) })} className={tealInput} aria-label="Unit cost" />
          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="text-rose-600" aria-label="Remove line">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((x) => [...x, { key: "", qty: 1, cost: 0 }])} className="text-sm font-medium text-emerald-700 hover:underline">➕ Add line</button>
    </div>
  );
}
