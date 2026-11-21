import Link from "next/link";
import { redirect } from "next/navigation";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { can, requireStaff } from "@/lib/store-auth";
import { fill } from "@/lib/i18n";
import { dateLocale } from "@/lib/languages";
import { panelPrefs, pStatus } from "@/lib/panel-i18n";
import { Badge, Card, Checklist, STATUS_TONE, Stat } from "@/components/admin/ui";
import { markOnboarding } from "../manage-actions";

export const metadata = { title: "Store panel" };

function windows() {
  const now = Date.now();
  const day14 = new Date(now - 13 * 86400_000);
  day14.setHours(0, 0, 0, 0);
  return { since: new Date(now - 30 * 86400_000), day14 };
}

export default async function ManageHome({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const user = await requireStaff(store);
  const b = `${store.base}/manage`;
  if (user.role === "cashier") redirect(`${b}/pos`);
  if (user.role === "seller") redirect(`${b}/seller`);
  const m = await storeModels(store);
  const f = store.features;
  const { since, day14 } = windows();
  const { p, lang, t: T } = await panelPrefs(store);
  const L = p;

  const [agg, daily, top, lowStock, recent, productCount, pendingCount] = await Promise.all([
    m.Order.aggregate<{ n: number; revenue: number }>([
      { $match: { createdAt: { $gte: since }, status: { $nin: ["cancelled", "refunded"] } } },
      { $group: { _id: null, n: { $sum: 1 }, revenue: { $sum: "$total" } } },
    ]),
    m.Order.aggregate<{ _id: string; revenue: number }>([
      { $match: { createdAt: { $gte: day14 }, status: { $nin: ["cancelled", "refunded"] } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Karachi" } }, revenue: { $sum: "$total" } } },
    ]),
    m.Order.aggregate<{ _id: string; qty: number; revenue: number }>([
      { $match: { createdAt: { $gte: since }, status: { $nin: ["cancelled", "refunded"] } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", qty: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    f["F-17"] && f["F-18"] ? m.Product.find({ status: "active", stock: { $lte: store.settings.lowStockAt } }).sort({ stock: 1 }).limit(8).lean() : Promise.resolve([]),
    m.Order.find().sort({ createdAt: -1 }).limit(6).lean(),
    m.Product.countDocuments(),
    m.Order.countDocuments({ status: "pending" }),
  ]);
  const s = agg[0] ?? { n: 0, revenue: 0 };
  const fm = (n: number) => formatMoney(n, store.currency);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(day14.getTime() + i * 86400_000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
    return { key, label: d.toLocaleDateString(dateLocale(lang), { timeZone: "Asia/Karachi", day: "numeric", month: "short" }), v: daily.find((x) => x._id === key)?.revenue ?? 0 };
  });
  const maxV = Math.max(1, ...days.map((d) => d.v));

  const done = new Set(store.onboarding.done);
  const steps = [
    { label: p.stepBrand, done: done.has("brand"), href: `${b}/welcome?step=brand` },
    { label: p.stepProduct, done: done.has("product") || productCount > 0, href: `${b}/products/new` },
    { label: p.stepShipping, done: done.has("shipping"), href: `${b}/welcome?step=shipping` },
    { label: p.stepFeatures, done: done.has("features"), href: `${b}/welcome?step=features` },
    { label: p.stepLaunch, done: done.has("launch"), href: `${b}/welcome?step=launch` },
  ];
  const showOnboarding = can(user.role, "settings") && !store.onboarding.dismissed && steps.some((x) => !x.done);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{p.dashboard}</h1>
          <p className="text-sm text-slate-500">{fill(p.last30, { store: store.name })}</p>
        </div>
        {pendingCount > 0 && <Link href={`${b}/orders?status=pending`} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">{lang !== "en" ? fill(p.newOrders, { n: pendingCount }) : `🔔 ${pendingCount} new order${pendingCount > 1 ? "s" : ""} to confirm`}</Link>}
      </div>

      {showOnboarding && (
        <Card accent="emerald" title={p.setUp} actions={<form action={markOnboarding.bind(null, site, "dismiss")}><button className="text-xs text-slate-500 hover:text-slate-800">{p.hide}</button></form>}>
          <p className="mb-4 text-sm text-slate-600">{p.fiveSteps}</p>
          <Checklist items={steps} />
          <Link href={`${b}/welcome`} className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:underline">{p.openWizard}</Link>
        </Card>
      )}

      {f["F-49"] ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={p.revenue} value={fm(s.revenue)} tone="emerald" icon="💰" />
            <Stat label={p.orders} value={s.n} tone="sky" icon="🧾" />
            <Stat label={p.avgOrder} value={fm(s.n ? Math.round(s.revenue / s.n) : 0)} tone="violet" icon="📈" />
            <Stat label={p.products} value={productCount} tone="amber" icon="📦" />
          </div>
          <Card title={p.sales14} accent="emerald">
            <div className="flex h-40 gap-1.5" role="img" aria-label={T("Daily sales for the last 14 days")}>
              {days.map((d) => (
                <div key={d.key} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="relative w-full flex-1">
                    <div className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400 transition group-hover:from-emerald-600" style={{ height: `${(d.v / maxV) * 100}%`, minHeight: d.v ? 4 : 1 }} title={`${d.label}: ${fm(d.v)}`} />
                  </div>
                  <span className="text-[10px] text-slate-500">{d.label.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card><p className="text-sm text-slate-600"><Link href={`${b}/features`} className="text-emerald-700 underline">{p.turnOnAnalytics}</Link></p></Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={p.recentOrders} accent="sky" actions={<Link href={`${b}/orders`} className="text-sm text-emerald-700 hover:underline">{p.allOrders}</Link>}>
          {recent.length === 0 ? <p className="text-sm text-slate-500">{p.noOrdersYet}</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {recent.map((o) => (
                <li key={o.number} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`${b}/orders/${o.number}`} className="font-semibold hover:underline">#{o.number}</Link>
                  <span className="truncate text-slate-600">{o.customer.name || (o.channel === "pos" ? p.walkIn : "")}</span>
                  <Badge tone={STATUS_TONE[o.status]}>{pStatus(p, o.status)}</Badge>
                  <span className="font-medium">{fm(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          {f["F-49"] && (
            <Card title={p.topProducts} accent="violet">
              {top.length === 0 ? <p className="text-sm text-slate-500">{p.salesShowHere}</p> : (
                <ul className="space-y-2 text-sm">
                  {top.map((t, i) => (
                    <li key={t._id} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{i + 1}</span>
                      <span className="flex-1 truncate">{t._id}</span>
                      <span className="text-slate-500">{fill(p.sold, { n: t.qty })}</span>
                      <span className="font-medium">{fm(t.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {f["F-18"] && f["F-17"] && (
            <Card title={p.lowStock} accent="amber">
              {lowStock.length === 0 ? <p className="text-sm text-slate-500">{p.wellStocked}</p> : (
                <ul className="space-y-1 text-sm">
                  {lowStock.map((p) => (
                    <li key={String(p._id)} className="flex justify-between">
                      <Link href={`${b}/products/${p._id}`} className="hover:underline">{p.name}</Link>
                      <span className={p.stock <= 0 ? "font-semibold text-rose-600" : "text-amber-700"}>{p.stock <= 0 ? L.out : fill(L.left, { n: p.stock })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
