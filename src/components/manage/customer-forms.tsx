"use client";

import { useActionState } from "react";
import { adjustCredit, staffReply, type MState } from "@/app/s/[site]/manage/manage-actions";
import { KeepForm } from "@/components/keep-form";
import { FormMessage, btnTealCls, inputCls } from "@/components/admin/ui";
import { usePT } from "@/components/manage/panel-lang";

const tealInput = inputCls.replaceAll("indigo", "emerald");

export function StaffReplyForm({ site, id }: { site: string; id: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(staffReply.bind(null, site, id), undefined);
  return (
    <KeepForm action={a} className="mt-2 space-y-2">
      <textarea name="text" rows={2} required placeholder={T("Reply to the customer…")} className={tealInput} aria-label={T("Reply")} />
      <div className="flex flex-wrap items-center gap-3">
        <button className={btnTealCls} disabled={p}>{p ? T("Sending…") : T("Send reply")}</button>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="close" value="1" /> {T("Close ticket")}</label>
      </div>
      <FormMessage state={s} />
    </KeepForm>
  );
}

export function CreditForm({ site, userId }: { site: string; userId: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(adjustCredit.bind(null, site, userId), undefined);
  return (
    <KeepForm action={a} className="flex flex-wrap items-center gap-2">
      <input name="amount" type="number" step="1" placeholder={T("+/- amount")} className={`${tealInput} !w-28 !py-1`} aria-label={T("Credit amount")} />
      <input name="reason" placeholder={T("Reason")} className={`${tealInput} !w-40 !py-1`} aria-label={T("Reason")} />
      <button className="text-xs font-semibold text-emerald-700 hover:underline" disabled={p}>{T("Apply")}</button>
      <FormMessage state={s} />
    </KeepForm>
  );
}
