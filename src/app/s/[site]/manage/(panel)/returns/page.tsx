import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore, storeModels, formatMoney } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card, btnSecondaryCls, btnTealCls } from "@/components/admin/ui";
import { decideReturn } from "../../manage-actions";

export const metadata = { title: "Returns" };

const TONE = { requested: "amber", approved: "sky", rejected: "slate", completed: "green" } as const;

export default async function Returns({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-46"]) notFound();
  await requireStaff(store, "orders");
  const list = await (await storeModels(store)).Return.find().sort({ createdAt: -1 }).limit(200).lean();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Returns and exchanges</h1>
        <p className="text-sm text-slate-500">Approve a request, collect the item, then mark it completed. Completing restocks the items and refunds, credits, or records the exchange.</p>
      </div>
      <Card accent="rose">
        {list.length === 0 ? <p className="text-sm text-slate-500">No return requests yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {list.map((r) => {
              const amount = r.items.reduce((n, i) => n + i.price * i.qty, 0);
              return (
                <li key={String(r._id)} className="space-y-2 py-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[r.status]}>{r.status}</Badge>
                    <Badge tone="violet">{r.type}</Badge>
                    <Link href={`${store.base}/manage/orders/${r.orderNumber}`} className="font-semibold text-emerald-700 hover:underline">Order #{r.orderNumber}</Link>
                    <span className="text-slate-500">· {r.customerName} · {new Date(r.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span>
                    <span className="ms-auto font-medium">{formatMoney(amount, store.currency)}</span>
                  </div>
                  <ul className="text-slate-700">{r.items.map((i, n) => <li key={n}>• {i.name} × {i.qty}</li>)}</ul>
                  <p className="text-slate-600">“{r.reason}”</p>
                  {r.note && <p className="text-xs text-slate-500">Note: {r.note}</p>}
                  {(r.status === "requested" || r.status === "approved") && (
                    <form className="flex flex-wrap items-center gap-2">
                      <input name="note" placeholder="Note (optional)" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                      {r.status === "requested" && <button formAction={decideReturn.bind(null, site, String(r._id), "approved")} className={btnTealCls}>Approve</button>}
                      {r.status === "approved" && <button formAction={decideReturn.bind(null, site, String(r._id), "completed")} className={btnTealCls}>Mark completed</button>}
                      <button formAction={decideReturn.bind(null, site, String(r._id), "rejected")} className={btnSecondaryCls}>Reject</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
