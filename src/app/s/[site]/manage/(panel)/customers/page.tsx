import Link from "next/link";
import { requireStore, storeModels, formatMoney } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card, Stat } from "@/components/admin/ui";
import { CreditForm } from "@/components/manage/customer-forms";
import { setWholesale } from "../../manage-actions";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Customers" };

type Seg = "new" | "repeat" | "vip" | "lapsed";
const SEG_LABEL: Record<Seg, string> = { new: "🌱 New", repeat: "🔁 Repeat", vip: "👑 VIP", lapsed: "💤 Lapsed" };
const SEG_TONE = { new: "sky", repeat: "indigo", vip: "violet", lapsed: "slate" } as const;

/** F-72: automatic segments from order history. */
function segmentsOf(r: { orders: number; spent: number; last: Date }, vipSpend: number, now: number): Seg[] {
  const s: Seg[] = [];
  if (r.orders === 1) s.push("new");
  if (r.orders >= 2) s.push("repeat");
  if (r.orders >= 5 || (vipSpend > 0 && r.spent >= vipSpend)) s.push("vip");
  if (now - new Date(r.last).getTime() > 90 * 86400_000) s.push("lapsed");
  return s;
}

const nowMs = () => Date.now();

export default async function Customers({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ seg?: string }> }) {
  const { site } = await params;
  const { seg } = await searchParams;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  await requireStaff(store, "customers");
  const f = store.features;
  const m = await storeModels(store);
  const [rows, accounts, subs] = await Promise.all([
    m.Order.aggregate<{ _id: string; name: string; phone: string; orders: number; spent: number; last: Date }>([
      { $match: { "customer.email": { $ne: "" }, status: { $nin: ["cancelled"] } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$customer.email", name: { $first: "$customer.name" }, phone: { $first: "$customer.phone" }, orders: { $sum: 1 }, spent: { $sum: "$total" }, last: { $first: "$createdAt" } } },
      { $sort: { spent: -1 } },
      { $limit: 500 },
    ]),
    m.User.find({ role: "customer" }).lean(),
    f["F-44"] ? m.Subscriber.countDocuments() : Promise.resolve(0),
  ]);
  const byEmail = new Map(accounts.map((u) => [u.email, u]));
  const spends = rows.map((r) => r.spent).sort((a, b) => b - a);
  const vipSpend = spends.length >= 10 ? spends[Math.floor(spends.length * 0.1)] : 0;
  const now = nowMs();
  const withSeg = rows.map((r) => ({ ...r, segs: f["F-72"] ? segmentsOf(r, vipSpend, now) : [] }));
  const shown = f["F-72"] && seg ? withSeg.filter((r) => r.segs.includes(seg as Seg)) : withSeg;
  const count = (s: Seg) => withSeg.filter((r) => r.segs.includes(s)).length;
  const b = `${store.base}/manage`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{T("Customers")}</h1>
        <div className="flex gap-2 text-sm">
          {f["F-50"] && <a href={`${b}/export/customers`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50">{T("⬇️ Customers CSV")}</a>}
          {f["F-44"] && <a href={`${b}/export/subscribers`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50">📬 Subscribers CSV ({subs})</a>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={T("Buyers")} value={rows.length} tone="sky" icon="🧑‍🤝‍🧑" />
        <Stat label={T("Accounts")} value={accounts.length} tone="emerald" icon="👤" />
        {f["F-44"] && <Stat label={T("Subscribers")} value={subs} tone="amber" icon="📬" />}
        {f["F-72"] && <Stat label={T("VIPs")} value={count("vip")} tone="violet" icon="👑" />}
      </div>
      {f["F-72"] && (
        <div className="flex flex-wrap gap-1">
          <Link href={`${b}/customers`} className={`rounded-full px-3 py-1.5 text-sm ${!seg ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>{T("All")}</Link>
          {(Object.keys(SEG_LABEL) as Seg[]).map((s) => (
            <Link key={s} href={`${b}/customers?seg=${s}`} className={`rounded-full px-3 py-1.5 text-sm ${seg === s ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>{SEG_LABEL[s]} ({count(s)})</Link>
          ))}
        </div>
      )}
      <Card accent="sky">
        {shown.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{T("Customers appear here after their first order.")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2">{T("Customer")}</th><th>{T("Orders")}</th><th>{T("Spent")}</th><th>{T("Last order")}</th>{(f["F-28"] || f["F-56"] || f["F-61"]) && <th>{T("Account")}</th>}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r) => {
                  const u = byEmail.get(r._id);
                  return (
                    <tr key={r._id} className="align-top">
                      <td className="py-2.5">
                        <p className="font-medium">{r.name} {u && <span title={T("Has an account")}>👤</span>}</p>
                        <p className="text-xs text-slate-500">{r._id} · {r.phone}</p>
                        <div className="mt-1 flex flex-wrap gap-1">{r.segs.map((s) => <Badge key={s} tone={SEG_TONE[s]}>{SEG_LABEL[s]}</Badge>)}{u?.wholesale && <Badge tone="amber">{T("Wholesale")}</Badge>}</div>
                      </td>
                      <td>{r.orders}</td>
                      <td className="font-medium">{formatMoney(r.spent, store.currency)}</td>
                      <td className="text-slate-600">{new Date(r.last).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</td>
                      {(f["F-28"] || f["F-56"] || f["F-61"]) && (
                        <td className="space-y-1 text-xs">
                          {!u ? <span className="text-slate-400">{T("Guest")}</span> : (
                            <>
                              {f["F-28"] && <p>⭐ {u.loyaltyPoints ?? 0} points</p>}
                              {f["F-56"] && <><p>💳 {formatMoney(u.storeCredit ?? 0, store.currency)} credit</p><CreditForm site={site} userId={String(u._id)} /></>}
                              {f["F-61"] && (
                                <form action={setWholesale.bind(null, site, String(u._id), !u.wholesale)}>
                                  <button className="text-emerald-700 hover:underline">{u.wholesale ? T("Remove wholesale pricing") : T("Give wholesale pricing")}</button>
                                </form>
                              )}
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
