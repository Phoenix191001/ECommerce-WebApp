import { notFound } from "next/navigation";
import { formatMoney, requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { storeUrl } from "@/lib/subdomain";
import { affiliateTotals } from "@/lib/affiliates";
import { Badge, Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { createAffiliate, payAffiliate, saveRewardSettings, setAffiliateRate, setAffiliateStatus } from "../../growth-actions";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Affiliates" };
const input = inputCls.replaceAll("indigo", "emerald");

export default async function Affiliates({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  await requireStaff(store, "discounts");
  if (!store.features["F-71"]) notFound();
  const m = await storeModels(store);
  const [list, totals] = await Promise.all([m.Affiliate.find().sort({ status: 1, createdAt: -1 }).lean(), affiliateTotals(m)]);
  const fm = (n: number) => formatMoney(n, store.currency);
  const root = store.customDomain ? `https://${store.customDomain}` : storeUrl(store.subdomain);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{T("🤝 Affiliates")}</h1>
        <p className="text-sm text-slate-500">{T("Affiliates share their link. Orders placed within 30 days of a click earn them a commission on the items (before delivery fees). Commission is payable once the order is delivered. Customers can also apply from their account page.")}</p>
      </div>
      <Card title={T("➕ Add an affiliate")} accent="emerald">
        <ActionForm action={createAffiliate.bind(null, site)} submit={T("Add affiliate")} reset>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={T("Name")}><input name="name" required className={input} /></Field>
            <Field label={T("Email")}><input name="email" type="email" required className={input} /></Field>
            <Field label={T("Code")} hint={T("Optional, e.g. ALI10")}><input name="code" className={`${input} uppercase`} /></Field>
            <Field label={T("Commission %")}><input name="rate" type="number" min="0" max="90" step="0.5" defaultValue={store.settings.affiliateRate} className={input} /></Field>
          </div>
        </ActionForm>
      </Card>
      <Card accent="violet" title={T("Affiliates")}>
        {list.length === 0 ? <p className="text-sm text-slate-500">{T("No affiliates yet.")}</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {list.map((a) => {
              const t = totals.get(a.code);
              return (
                <li key={String(a._id)} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <b>{a.name}</b><span className="text-slate-500">{a.email}</span>
                    <code className="rounded bg-slate-100 px-1.5 font-semibold">{a.code}</code>
                    <Badge tone={a.status === "active" ? "green" : a.status === "pending" ? "amber" : "slate"}>{a.status}</Badge>
                    <span className="ms-auto flex gap-3">
                      {a.status !== "active" && <form action={setAffiliateStatus.bind(null, site, String(a._id), "active")}><button className="text-xs font-semibold text-emerald-700 hover:underline">{a.status === "pending" ? T("Approve") : T("Resume")}</button></form>}
                      {a.status === "active" && <form action={setAffiliateStatus.bind(null, site, String(a._id), "paused")}><button className="text-xs text-slate-600 hover:underline">{T("Pause")}</button></form>}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    {a.clicks} clicks · {t?.orders ?? 0} orders · {fm(t?.sales ?? 0)} sales · earned <b>{fm(t?.earned ?? 0)}</b> · {a.rate}%
                    {t && t.unpaid > 0 && <> · <b className="text-amber-700">{fm(t.unpaid)} to pay</b></>}
                  </p>
                  <p className="break-all font-mono text-xs text-slate-500">{root}/a/{a.code}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {t && t.unpaid > 0 && <form action={payAffiliate.bind(null, site, a.code)}><button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Mark {fm(t.unpaid)} as paid</button></form>}
                    <details>
                      <summary className="cursor-pointer text-xs text-emerald-700">{T("Change commission")}</summary>
                      <ActionForm action={setAffiliateRate.bind(null, site, String(a._id))} submit={T("Save")} className="mt-2 flex items-end gap-2">
                        <Field label={T("Commission %")}><input name="rate" type="number" min="0" max="90" step="0.5" defaultValue={a.rate} className={`${input} w-28`} /></Field>
                      </ActionForm>
                    </details>
                    <a href={`${store.base}/a/${a.code}/stats?k=${a.statsKey}`} target="_blank" className="text-xs text-slate-600 hover:underline">Affiliate&apos;s stats page ↗</a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title={T("Default commission for new applicants")} accent="sky">
        <ActionForm action={saveRewardSettings.bind(null, site)} submit={T("Save")} className="flex items-end gap-3">
          <Field label={T("Commission %")}><input name="affiliateRate" type="number" min="0" max="90" defaultValue={store.settings.affiliateRate} className={`${input} w-28`} /></Field>
        </ActionForm>
      </Card>
    </>
  );
}
