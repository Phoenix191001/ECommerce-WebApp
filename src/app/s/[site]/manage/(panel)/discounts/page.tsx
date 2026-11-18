import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card } from "@/components/admin/ui";
import { DiscountForm } from "@/components/manage/forms";
import { deleteDiscount, toggleDiscount } from "../../manage-actions";

export const metadata = { title: "Discounts" };

export default async function Discounts({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "discounts");
  const codes = await (await storeModels(store)).Discount.find().sort({ createdAt: -1 }).lean();
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Discount codes</h1>
      <Card title="➕ New code" accent="emerald"><DiscountForm site={site} /></Card>
      <Card accent="amber">
        {codes.length === 0 ? <p className="text-sm text-slate-500">No codes yet. Customers enter codes in the cart.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {codes.map((d) => (
              <li key={String(d._id)} className="flex flex-wrap items-center gap-3 py-3">
                <code className="rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-900">{d.code}</code>
                <span>{d.type === "percent" ? `${d.value}% off` : `${formatMoney(d.value, store.currency)} off`}</span>
                {d.minSubtotal > 0 && <span className="text-slate-500">over {formatMoney(d.minSubtotal, store.currency)}</span>}
                <span className="text-slate-500">used {d.used}{d.usageLimit ? `/${d.usageLimit}` : ""}</span>
                {d.expiresAt && <span className="text-slate-500">until {new Date(d.expiresAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span>}
                <Badge tone={d.active ? "green" : "slate"}>{d.active ? "active" : "paused"}</Badge>
                <span className="ml-auto flex gap-2">
                  <form action={toggleDiscount.bind(null, site, String(d._id))}><button className="text-xs text-slate-600 hover:underline">{d.active ? "Pause" : "Resume"}</button></form>
                  <form action={deleteDiscount.bind(null, site, String(d._id))}><button className="text-xs text-rose-600 hover:underline">Delete</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
