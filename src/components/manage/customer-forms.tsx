"use client";

import { useActionState } from "react";
import { adjustCredit, staffReply, type MState } from "@/app/s/[site]/manage/manage-actions";
import { KeepForm } from "@/components/keep-form";
import { FormMessage, btnTealCls, inputCls } from "@/components/admin/ui";

const tealInput = inputCls.replaceAll("indigo", "emerald");

export function StaffReplyForm({ site, id }: { site: string; id: string }) {
  const [s, a, p] = useActionState<MState, FormData>(staffReply.bind(null, site, id), undefined);
  return (
    <KeepForm action={a} className="mt-2 space-y-2">
      <textarea name="text" rows={2} required placeholder="Reply to the customer…" className={tealInput} aria-label="Reply" />
      <div className="flex flex-wrap items-center gap-3">
        <button className={btnTealCls} disabled={p}>{p ? "Sending…" : "Send reply"}</button>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="close" value="1" /> Close ticket</label>
      </div>
      <FormMessage state={s} />
    </KeepForm>
  );
}

export function CreditForm({ site, userId }: { site: string; userId: string }) {
  const [s, a, p] = useActionState<MState, FormData>(adjustCredit.bind(null, site, userId), undefined);
  return (
    <KeepForm action={a} className="flex flex-wrap items-center gap-2">
      <input name="amount" type="number" step="1" placeholder="+/- amount" className={`${tealInput} !w-28 !py-1`} aria-label="Credit amount" />
      <input name="reason" placeholder="Reason" className={`${tealInput} !w-40 !py-1`} aria-label="Reason" />
      <button className="text-xs font-semibold text-emerald-700 hover:underline" disabled={p}>Apply</button>
      <FormMessage state={s} />
    </KeepForm>
  );
}
