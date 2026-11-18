import { notFound } from "next/navigation";
import { requireStore, storeModels, formatMoney } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card, Stat } from "@/components/admin/ui";
import { ExpenseForm } from "@/components/manage/ops-forms";
import { deleteExpense } from "../../manage-actions";

export const metadata = { title: "Profit report" };

const range = (days: number) => ({ since: new Date(Date.now() - days * 86400_000), today: new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10) });

// F-82: revenue − cost of goods − refunds − expenses.
export default async function Reports({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ days?: string }> }) {
  const { site } = await params;
  const { days: d } = await searchParams;
  const store = await requireStore(site);
  if (!store.features["F-82"]) notFound();
  await requireStaff(store, "reports");
  const days = [7, 30, 90, 365].includes(Number(d)) ? Number(d) : 30;
  const { since, today } = range(days);
  const m = await storeModels(store);
  const [sales, refunds, expenses, byCat] = await Promise.all([
    m.Order.aggregate<{ revenue: number; cogs: number; orders: number }>([
      { $match: { createdAt: { $gte: since }, status: { $ne: "cancelled" } } },
      { $project: { total: 1, cogs: { $sum: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.qty", { $ifNull: ["$$i.cost", 0] }] } } } } } },
      { $group: { _id: null, revenue: { $sum: "$total" }, cogs: { $sum: "$cogs" }, orders: { $sum: 1 } } },
    ]),
    m.Order.aggregate<{ total: number }>([
      { $match: { "refunds.at": { $gte: since } } }, { $unwind: "$refunds" }, { $match: { "refunds.at": { $gte: since } } },
      { $group: { _id: null, total: { $sum: "$refunds.amount" } } },
    ]),
    m.Expense.find({ date: { $gte: since } }).sort({ date: -1 }).limit(200).lean(),
    m.Expense.aggregate<{ _id: string; total: number }>([{ $match: { date: { $gte: since } } }, { $group: { _id: "$category", total: { $sum: "$amount" } } }, { $sort: { total: -1 } }]),
  ]);
  const s = sales[0] ?? { revenue: 0, cogs: 0, orders: 0 };
  const ref = refunds[0]?.total ?? 0;
  const exp = expenses.reduce((n, e) => n + e.amount, 0);
  const profit = s.revenue - ref - s.cogs - exp;
  const fm = (n: number) => formatMoney(n, store.currency);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Profit report</h1>
        <div className="flex gap-1">{[7, 30, 90, 365].map((x) => <a key={x} href={`?days=${x}`} className={`rounded-full px-3 py-1.5 text-sm ${days === x ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>{x === 365 ? "1 year" : `${x} days`}</a>)}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Revenue" value={fm(s.revenue)} tone="sky" icon="💰" />
        <Stat label="Cost of goods" value={fm(s.cogs)} tone="amber" icon="📦" />
        <Stat label="Refunds" value={fm(ref)} tone="rose" icon="↩️" />
        <Stat label="Expenses" value={fm(exp)} tone="violet" icon="🧾" />
        <Stat label="Profit" value={fm(profit)} tone={profit >= 0 ? "emerald" : "rose"} icon={profit >= 0 ? "📈" : "📉"} />
      </div>
      <p className="text-xs text-slate-500">Cost of goods uses each product&apos;s cost price at the time of the order. Set cost prices on products to make this accurate.</p>
      <Card title="➕ Add expense" accent="emerald"><ExpenseForm site={site} today={today} /></Card>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title="By category" accent="violet">
          {byCat.length === 0 ? <p className="text-sm text-slate-500">No expenses in this period.</p> : (
            <ul className="space-y-2 text-sm">{byCat.map((c) => (
              <li key={c._id}>
                <div className="flex justify-between"><span>{c._id}</span><b>{fm(c.total)}</b></div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${(c.total / Math.max(1, exp)) * 100}%` }} /></div>
              </li>
            ))}</ul>
          )}
        </Card>
        <Card title="Expenses" accent="amber">
          {expenses.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">{expenses.map((e) => (
              <li key={String(e._id)} className="flex items-center justify-between gap-2 py-2">
                <span>{new Date(e.date).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })} · {e.category}{e.note && <span className="text-slate-500"> · {e.note}</span>}</span>
                <span className="flex items-center gap-3"><b>{fm(e.amount)}</b><form action={deleteExpense.bind(null, site, String(e._id))}><button className="text-xs text-rose-600 hover:underline">Delete</button></form></span>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
