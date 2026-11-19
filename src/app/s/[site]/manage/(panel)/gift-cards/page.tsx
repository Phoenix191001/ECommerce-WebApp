import { notFound } from "next/navigation";
import { formatMoney, requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { adjustGiftCard, createGiftCard, toggleGiftCard } from "../../growth-actions";

export const metadata = { title: "Gift cards" };
const input = inputCls.replaceAll("indigo", "emerald");

export default async function GiftCards({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string }> }) {
  const { site } = await params;
  const { q } = await searchParams;
  const store = await requireStore(site);
  await requireStaff(store, "discounts");
  if (!store.features["F-32"]) notFound();
  const m = await storeModels(store);
  const code = q?.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const [cards, totals] = await Promise.all([
    m.GiftCard.find(code ? { code: { $regex: code.replace(/-/g, "-?") } } : {}).sort({ createdAt: -1 }).limit(100).lean(),
    m.GiftCard.aggregate<{ issued: number; open: number; n: number }>([{ $group: { _id: null, issued: { $sum: "$initial" }, open: { $sum: { $cond: ["$active", "$balance", 0] } }, n: { $sum: 1 } } }]),
  ]);
  const fm = (n: number) => formatMoney(n, store.currency);
  const t = totals[0] ?? { issued: 0, open: 0, n: 0 };
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🎁 Gift cards</h1>
        <p className="text-sm text-slate-500">{t.n} cards · {fm(t.issued)} issued · {fm(t.open)} still to be spent. To sell gift cards online, add a product and choose “Gift card” as its kind.</p>
      </div>
      <Card title="➕ Create a gift card" accent="emerald">
        <ActionForm action={createGiftCard.bind(null, site)} submit="Create gift card" reset>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Value"><input name="amount" type="number" min="1" required className={input} /></Field>
            <Field label="Send to (email)" hint="Optional. We email the code."><input name="recipient" type="email" className={input} /></Field>
            <Field label="Expires after (days)" hint="0 = never"><input name="days" type="number" min="0" defaultValue={365} className={input} /></Field>
          </div>
          <Field label="Note or message"><input name="note" maxLength={200} className={input} placeholder="e.g. Sold at the counter / Sorry for the delay" /></Field>
        </ActionForm>
      </Card>
      <Card accent="violet" title="All gift cards">
        <form className="mb-3"><input name="q" defaultValue={q} placeholder="Find a code…" className={`${input} max-w-xs font-mono`} /></form>
        {cards.length === 0 ? <p className="text-sm text-slate-500">No gift cards yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {cards.map((g) => (
              <li key={String(g._id)} className="flex flex-wrap items-center gap-3 py-3">
                <code className="rounded-lg bg-violet-100 px-2 py-1 font-bold tracking-wider text-violet-900">{g.code}</code>
                <span><b>{fm(g.balance)}</b> <span className="text-slate-500">of {fm(g.initial)}</span></span>
                {g.recipient && <span className="text-slate-500">→ {g.recipient}</span>}
                {g.orderNumber && <span className="text-slate-500">bought in #{g.orderNumber}</span>}
                {g.expiresAt && <span className="text-slate-500">expires {new Date(g.expiresAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span>}
                <Badge tone={!g.active ? "slate" : g.balance > 0 ? "green" : "amber"}>{!g.active ? "disabled" : g.balance > 0 ? "active" : "used up"}</Badge>
                <span className="ms-auto flex items-center gap-3">
                  <details className="relative">
                    <summary className="cursor-pointer text-xs text-emerald-700">Adjust</summary>
                    <div className="absolute end-0 z-10 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                      <ActionForm action={adjustGiftCard.bind(null, site, String(g._id))} submit="Apply">
                        <Field label="Add or remove" hint="e.g. 500 or -500"><input name="amount" type="number" required className={input} /></Field>
                      </ActionForm>
                    </div>
                  </details>
                  <form action={toggleGiftCard.bind(null, site, String(g._id))}><button className="text-xs text-slate-600 hover:underline">{g.active ? "Disable" : "Enable"}</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
