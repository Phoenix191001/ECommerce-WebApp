import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card, inputCls } from "@/components/admin/ui";
import { StaffForm } from "@/components/manage/forms";
import { removeStaff, updateStaff } from "../../manage-actions";

export const metadata = { title: "Staff" };

export default async function Staff({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const me = await requireStaff(store, "staff");
  const staff = await (await storeModels(store)).User.find({ role: { $in: ["owner", "manager", "cashier"] } }).sort({ role: 1, name: 1 }).lean();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
        <p className="text-sm text-slate-500">Owners manage everything. Managers handle catalog, orders, discounts, and the POS. Cashiers use the POS only.</p>
      </div>
      <Card title="➕ Add staff" accent="emerald"><StaffForm site={site} canAddManager={me.role === "owner"} /></Card>
      <Card accent="sky">
        <ul className="divide-y divide-slate-100 text-sm">
          {staff.map((s) => (
            <li key={String(s._id)} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 font-bold text-white">{s.name[0]}</span>
              <div className="min-w-[10rem] flex-1"><p className="font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.email}</p></div>
              <Badge tone={s.role === "owner" ? "violet" : s.role === "manager" ? "indigo" : "sky"}>{s.role}</Badge>
              {s.role !== "owner" && (me.role === "owner" || s.role === "cashier") && (
                <>
                  <form action={updateStaff.bind(null, site, String(s._id))} className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Refund limit</label>
                    <input name="refundLimit" type="number" min="0" defaultValue={s.refundLimit} className={`${inputCls} !w-24 !py-1`} aria-label={`Refund limit for ${s.name}`} />
                    {s.role === "manager" && <input name="pin" inputMode="numeric" placeholder={s.pinHash ? "New PIN" : "Set PIN"} className={`${inputCls} !w-24 !py-1`} aria-label="Manager PIN" />}
                    <button className="text-xs font-medium text-emerald-700 hover:underline">Save</button>
                  </form>
                  <form action={removeStaff.bind(null, site, String(s._id))}><button className="text-xs text-rose-600 hover:underline">Remove</button></form>
                </>
              )}
              {s.role !== "owner" && <span className="w-full pl-12 text-xs text-slate-500">Can refund up to {formatMoney(s.refundLimit, store.currency)} at the POS{s.role === "manager" ? (s.pinHash ? " · PIN set" : " · no PIN yet") : ""}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
