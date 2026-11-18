"use client";

import { useActionState } from "react";
import { addExpense, editOrder, type MState } from "@/app/s/[site]/manage/manage-actions";
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
