"use client";

import { useActionState } from "react";
import { answerQuestion, bulkUpdate, importProductsCsv, type MState } from "@/app/s/[site]/manage/manage-actions";
import { KeepForm } from "@/components/keep-form";
import { FormMessage, btnTealCls, inputCls } from "@/components/admin/ui";
import { usePT } from "@/components/manage/panel-lang";

const tealInput = inputCls.replaceAll("indigo", "emerald");

export function CsvImportForm({ site }: { site: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(importProductsCsv.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-3">
      <input type="file" name="file" accept=".csv,text/csv" className="block text-sm" aria-label={T("CSV file")} />
      <p className="text-xs text-slate-500">{T("…or paste CSV text:")}</p>
      <textarea name="csv" rows={4} className={`${tealInput} font-mono text-xs`} placeholder={"name,price,stock,category,sku,tags\nBlue Mug,850,20,Kitchen,MUG-BLU,gift;kitchen"} />
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? T("Importing…") : T("Import products")}</button>
    </KeepForm>
  );
}

type Row = { id: string; vid?: string; name: string; price?: number; inherited?: number; stock: number };

export function BulkEditForm({ site, rows, ids, currency }: { site: string; rows: Row[]; ids: string; currency: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(bulkUpdate.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-3">
      <input type="hidden" name="ids" value={ids} />
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm">
        <span>{T("Change all listed prices by")}</span>
        <input name="percent" type="number" step="1" min="-89" max="499" placeholder={T("e.g. -10")} className={`${tealInput} !w-28`} aria-label={T("Percent change")} />
        <span>% (negative = discount). Leave empty to skip.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">{T("Product")}</th><th>Price ({currency})</th><th>{T("Stock")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const k = r.vid ? `${r.id}_${r.vid}` : r.id;
              return (
                <tr key={k}>
                  <td className="py-1.5">{r.name}</td>
                  <td><input name={`price_${k}`} type="number" min="0" defaultValue={r.price} placeholder={r.inherited !== undefined ? `${r.inherited} (product)` : undefined} className={`${tealInput} !w-32 !py-1`} aria-label={`Price of ${r.name}`} /></td>
                  <td><input name={`stock_${k}`} type="number" min="0" step="1" defaultValue={r.stock} className={`${tealInput} !w-24 !py-1`} aria-label={`Stock of ${r.name}`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? T("Saving…") : T("Save all changes")}</button>
    </KeepForm>
  );
}

export function AnswerForm({ site, id, current }: { site: string; id: string; current?: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(answerQuestion.bind(null, site, id), undefined);
  return (
    <KeepForm action={a} className="mt-2 space-y-2">
      <textarea name="answer" rows={2} defaultValue={current} placeholder={T("Your answer (published on the product page)")} className={tealInput} aria-label={T("Answer")} />
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{current ? T("Update answer") : T("Publish answer")}</button>
    </KeepForm>
  );
}
