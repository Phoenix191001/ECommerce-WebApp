import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card, inputCls } from "@/components/admin/ui";
import { StaffForm } from "@/components/manage/forms";
import { clock, removeStaff, updateStaff } from "../../manage-actions";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Staff" };

const nowMs = () => Date.now();
const daysAgo = (n: number) => new Date(nowMs() - n * 86400_000);

export default async function Staff({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  const me = await requireStaff(store, "staff");
  const m = await storeModels(store);
  const staff = await m.User.find({ role: { $in: ["owner", "manager", "cashier"] } }).sort({ role: 1, name: 1 }).lean();
  const att = store.features["F-84"] ? await m.Attendance.find({ clockIn: { $gte: daysAgo(14) } }).sort({ clockIn: -1 }).limit(100).lean() : [];
  const myOpen = att.find((a) => String(a.staff) === String(me._id) && !a.clockOut);
  const hours = (a: { clockIn: Date; clockOut?: Date | null }) => (((a.clockOut ? new Date(a.clockOut).getTime() : nowMs()) - new Date(a.clockIn).getTime()) / 3600_000).toFixed(1);
  const t = (d: Date) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" });
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{T("Staff")}</h1>
        <p className="text-sm text-slate-500">{T("Owners manage everything. Managers handle catalog, orders, discounts, and the POS. Cashiers use the POS only.")}</p>
      </div>
      {store.features["F-84"] && (
        <Card title={T("🕒 Attendance")} accent="amber" actions={
          <form action={clock.bind(null, site, myOpen ? "out" : "in")}><button className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${myOpen ? "bg-rose-600" : "bg-emerald-600"}`}>{myOpen ? `Clock out (in since ${t(myOpen.clockIn)})` : "Clock in"}</button></form>
        }>
          {att.length === 0 ? <p className="text-sm text-slate-500">{T("No shifts in the last 14 days.")}</p> : (
            <ul className="divide-y divide-slate-100 text-sm">{att.map((a) => (
              <li key={String(a._id)} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span><b>{a.name}</b> · {t(a.clockIn)} → {a.clockOut ? t(a.clockOut) : <span className="text-emerald-700">{T("working now")}</span>}</span>
                <span className="text-slate-600">{hours(a)} h</span>
              </li>
            ))}</ul>
          )}
        </Card>
      )}
      <Card title={T("➕ Add staff")} accent="emerald"><StaffForm site={site} canAddManager={me.role === "owner"} /></Card>
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
                    <label className="text-xs text-slate-500">{T("Refund limit")}</label>
                    <input name="refundLimit" type="number" min="0" defaultValue={s.refundLimit} className={`${inputCls} !w-24 !py-1`} aria-label={`Refund limit for ${s.name}`} />
                    {s.role === "manager" && <input name="pin" inputMode="numeric" placeholder={s.pinHash ? T("New PIN") : T("Set PIN")} className={`${inputCls} !w-24 !py-1`} aria-label={T("Manager PIN")} />}
                    <button className="text-xs font-medium text-emerald-700 hover:underline">{T("Save")}</button>
                  </form>
                  <form action={removeStaff.bind(null, site, String(s._id))}><button className="text-xs text-rose-600 hover:underline">{T("Remove")}</button></form>
                </>
              )}
              {s.role !== "owner" && <span className="w-full pl-12 text-xs text-slate-500">Can refund up to {formatMoney(s.refundLimit, store.currency)} at the POS{s.role === "manager" ? (s.pinHash ? T(" · PIN set") : T(" · no PIN yet")) : ""}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
