import { notFound } from "next/navigation";
import { formatMoney, requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { sellerTotals } from "@/lib/marketplace";
import { Badge, Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { createSeller, recordPayout, sellerSetupLink, setSellerStatus, updateSeller } from "../../market-actions";

export const metadata = { title: "Sellers" };
const input = inputCls.replaceAll("indigo", "emerald");

export default async function Sellers({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "staff");
  if (!store.features["F-67"]) notFound();
  const m = await storeModels(store);
  const [rows, counts] = await Promise.all([
    sellerTotals(m),
    m.Product.aggregate<{ _id: unknown; n: number }>([{ $match: { seller: { $exists: true } } }, { $group: { _id: "$seller", n: { $sum: 1 } } }]),
  ]);
  const nProducts = new Map(counts.map((c) => [String(c._id), c.n]));
  const fm = (n: number) => formatMoney(n, store.currency);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🏪 Marketplace sellers</h1>
        <p className="text-sm text-slate-500">Other shops can sell through your store. Each seller signs in to manage only their own products and see orders for them. You keep a commission on their delivered sales and pay them the rest.</p>
      </div>
      <Card title="➕ Add a seller" accent="emerald">
        <ActionForm action={createSeller.bind(null, site)} submit="Add seller" reset>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Shop name"><input name="name" required className={input} /></Field>
            <Field label="Email (for sign-in)"><input name="email" type="email" required className={input} /></Field>
            <Field label="Phone"><input name="phone" className={input} /></Field>
            <Field label="Your commission %"><input name="rate" type="number" min="0" max="90" step="0.5" defaultValue={store.settings.sellerRate} className={input} /></Field>
          </div>
          <Field label="About the seller" hint="Shown on their page in your store."><textarea name="about" rows={2} className={input} /></Field>
        </ActionForm>
      </Card>
      {rows.map(({ seller: s, gross, orders, commission, earned, paid, owed }) => (
        <Card key={String(s._id)} accent={s.status === "active" ? "sky" : undefined}
          title={<span className="flex items-center gap-2">{s.name} <Badge tone={s.status === "active" ? "green" : "slate"}>{s.status}</Badge></span>}
          actions={<form action={setSellerStatus.bind(null, site, String(s._id), s.status === "active" ? "paused" : "active")}><button className="text-xs text-slate-600 hover:underline">{s.status === "active" ? "Pause (hides their products)" : "Resume"}</button></form>}>
          <p className="text-sm text-slate-600">{s.email}{s.phone && ` · ${s.phone}`} · {nProducts.get(String(s._id)) ?? 0} products · <a href={`${store.base}/seller/${s.slug}`} target="_blank" className="text-emerald-700 hover:underline">store page ↗</a></p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
            {[["Delivered sales", fm(gross)], ["Orders", orders], [`Your ${s.rate}%`, fm(commission)], ["Their share", fm(earned)], ["Owed now", fm(owed)]].map(([l, v]) => (
              <div key={String(l)} className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">{l}</p><p className="font-semibold">{v}</p></div>
            ))}
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <ActionForm action={recordPayout.bind(null, site, String(s._id))} submit="Record payout" reset className="space-y-2">
              <Field label="Paid to seller"><input name="amount" type="number" min="1" defaultValue={owed > 0 ? owed : undefined} className={input} /></Field>
              <Field label="Note"><input name="note" className={input} placeholder="Bank transfer ref…" /></Field>
            </ActionForm>
            <ActionForm action={updateSeller.bind(null, site, String(s._id))} submit="Save" className="space-y-2">
              <Field label="Commission %"><input name="rate" type="number" min="0" max="90" step="0.5" defaultValue={s.rate} className={input} /></Field>
              <Field label="Phone"><input name="phone" defaultValue={s.phone} className={input} /></Field>
              <Field label="About"><textarea name="about" rows={2} defaultValue={s.about} className={input} /></Field>
            </ActionForm>
            <div className="space-y-2 text-sm">
              <ActionForm action={sellerSetupLink.bind(null, site, String(s._id))} submit="🔑 New sign-in link"><span /></ActionForm>
              {s.payouts.length > 0 && (
                <ul className="text-xs text-slate-600">
                  {s.payouts.slice(-5).reverse().map((p, i) => <li key={i}>{new Date(p.at).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })} · {fm(p.amount)} {p.note && `· ${p.note}`}</li>)}
                  <li className="font-medium">Paid so far: {fm(paid)}</li>
                </ul>
              )}
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}
