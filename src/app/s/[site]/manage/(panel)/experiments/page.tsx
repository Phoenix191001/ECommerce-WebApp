import { notFound } from "next/navigation";
import { formatMoney, requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { significance } from "@/lib/ab";
import { Badge, Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { createExperiment, deleteExperiment, stopExperiment } from "../../growth-actions";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "A/B tests" };
const input = inputCls.replaceAll("indigo", "emerald");
const SECTIONS = { headline: "Home page headline", announcement: "Announcement bar", hero: "Home page banner image" };
const pct = (o: number, v: number) => (v ? `${((o / v) * 100).toFixed(1)}%` : "—");

export default async function Experiments({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  await requireStaff(store, "settings");
  if (!store.features["F-78"]) notFound();
  const tests = await (await storeModels(store)).Experiment.find().sort({ active: -1, createdAt: -1 }).lean();
  const fm = (n: number) => formatMoney(n, store.currency);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{T("🧪 A/B tests")}</h1>
        <p className="text-sm text-slate-500">{T("Show half your visitors version A and half version B, then see which one gets more orders. Each visitor always sees the same version.")}</p>
      </div>
      <Card title={T("➕ Start a test")} accent="emerald">
        <ActionForm action={createExperiment.bind(null, site)} submit={T("Start test")} reset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={T("Name")}><input name="name" className={input} placeholder={T("Summer headline")} /></Field>
            <Field label={T("What to test")}>
              <select name="section" className={input}>{Object.entries(SECTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
            <Field label={T("Version A")} hint={T("Text, or an https:// image link for the banner")}><textarea name="a" rows={2} required className={input} /></Field>
            <Field label={T("Version B")}><textarea name="b" rows={2} required className={input} /></Field>
          </div>
        </ActionForm>
      </Card>
      {tests.map((t) => {
        const sure = significance(t.views.a, t.orders.a, t.views.b, t.orders.b);
        const winner = t.views.a && t.views.b ? (t.orders.b / t.views.b > t.orders.a / t.views.a ? T("B") : T("A")) : null;
        return (
          <Card key={String(t._id)} accent={t.active ? "violet" : undefined} title={<span className="flex items-center gap-2">{t.name} <Badge tone={t.active ? "green" : "slate"}>{t.active ? "running" : "stopped"}</Badge></span>}
            actions={t.active ? <form action={stopExperiment.bind(null, site, String(t._id))}><button className="text-xs text-rose-600 hover:underline">{T("Stop test")}</button></form> : <form action={deleteExperiment.bind(null, site, String(t._id))}><button className="text-xs text-slate-500 hover:underline">{T("Delete")}</button></form>}>
            <p className="mb-3 text-xs text-slate-500">{SECTIONS[t.section]}</p>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-1 text-start">{T("Version")}</th><th className="text-start">{T("Views")}</th><th className="text-start">{T("Orders")}</th><th className="text-start">{T("Conversion")}</th><th className="text-end">{T("Revenue")}</th></tr></thead>
              <tbody>
                {(["a", "b"] as const).map((v) => (
                  <tr key={v} className="border-t border-slate-100">
                    <td className="py-2"><b>{v.toUpperCase()}</b> <span className="text-slate-600">{t[v].length > 60 ? `${t[v].slice(0, 60)}…` : t[v]}</span></td>
                    <td>{t.views[v]}</td><td>{t.orders[v]}</td><td>{pct(t.orders[v], t.views[v])}</td><td className="text-end">{fm(t.revenue[v])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              {!winner ? "Not enough visitors yet." : sure >= 95 ? <>🏆 Version <b>{winner}</b> wins ({sure}% sure). You can stop the test and use it.</> : <>Version {winner} is ahead, but it&apos;s only {sure}% sure. Keep the test running (aim for 95%).</>}
            </p>
          </Card>
        );
      })}
    </>
  );
}
