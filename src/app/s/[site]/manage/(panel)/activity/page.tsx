import { Types } from "mongoose";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { Badge, Card } from "@/components/admin/ui";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Activity" };

// F-122 / UX-04: the owner's change history.
export default async function Activity({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  await requireStaff(store, "settings");
  if (!store.features["F-122"]) notFound();
  const { AuditLog } = platformModels(await platformDb());
  const log = await AuditLog.find({ instance: new Types.ObjectId(store.id) }).sort({ createdAt: -1 }).limit(200).lean();
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{T("Activity")}</h1>
      <Card accent="amber">
        {log.length === 0 ? <p className="text-sm text-slate-500">{T("No changes yet.")}</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {log.map((e) => (
              <li key={String(e._id)} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={e.actorRole === "super_admin" ? "violet" : "green"}>{e.action}</Badge>
                  {e.target}
                  {typeof e.newValue === "boolean" && <span className="text-slate-500">{e.newValue ? "turned on" : "turned off"}</span>}
                </span>
                <span className="text-xs text-slate-500">{e.actorRole === "super_admin" ? "Platform admin" : e.actor} · {new Date(e.createdAt as Date).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
