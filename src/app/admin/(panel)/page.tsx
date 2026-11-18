import Link from "next/link";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans } from "@/lib/plans";
import { requireAdmin } from "@/lib/auth";
import { storeUrl } from "@/lib/subdomain";
import { Badge, Card, Checklist, STATUS_TONE, Stat, btnCls } from "@/components/admin/ui";
import { dismissChecklist } from "../actions";

export default async function DashboardPage() {
  const me = await requireAdmin();
  await ensurePlans();
  const { Instance, Plan, AuditLog, SuperAdmin } = platformModels(await platformDb());
  const [instances, plans, admin, linkMade, toggled, impersonated] = await Promise.all([
    Instance.find().sort({ createdAt: -1 }).limit(200).lean(),
    Plan.find().lean(),
    SuperAdmin.findOne({ email: me.email }).lean(),
    AuditLog.exists({ action: "owner.setup_link" }),
    AuditLog.exists({ action: { $in: ["toggle.set", "toggle.starter_pack"] }, actorRole: "super_admin" }),
    AuditLog.exists({ action: "owner.impersonate" }),
  ]);
  const planName = new Map(plans.map((p) => [String(p._id), p.name]));
  const active = instances.filter((i) => i.status === "active").length;

  const steps = [
    { label: "Turn on two-factor sign-in", done: !!admin?.totpEnabled },
    { label: "Review the plans stores can buy", done: plans.length > 0 && !!(await AuditLog.exists({ action: { $in: ["plan.update", "plan.create"] } })), href: "/admin/plans", hint: "Starter and Pro are ready to use. Edit which features each one includes." },
    { label: "Create your first store", done: instances.length > 0, href: "/admin/instances/new", hint: "Give it a name, a subdomain, a plan, and an owner." },
    { label: "Switch a feature on or off for a store", done: !!toggled, href: instances[0] ? `/admin/instances/${instances[0]._id}` : undefined, hint: "Open a store and use the feature switches. The store updates within seconds." },
    { label: "Send the owner their setup link", done: !!linkMade, href: instances[0] ? `/admin/instances/${instances[0]._id}` : undefined, hint: "The owner opens it to set a password and start the setup wizard." },
    { label: "Look at a store as its owner", done: !!impersonated, href: instances[0] ? `/admin/instances/${instances[0]._id}` : undefined, hint: "Use “Sign in as owner” to see the owner's panel." },
    { label: "Read the feature guide", done: false, href: "/guide", hint: "Explains every feature and which ones depend on others." },
  ];
  const showChecklist = !admin?.checklistDismissed && steps.slice(0, 6).some((s) => !s.done);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back 👋</h1>
          <p className="text-sm text-slate-500">Here's what's happening across your stores.</p>
        </div>
        <Link href="/admin/instances/new" className={btnCls}>➕ New store</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Stores" value={instances.length} tone="indigo" icon="🏬" />
        <Stat label="Active" value={active} tone="emerald" icon="✅" />
        <Stat label="Suspended" value={instances.length - active} tone="amber" icon="⏸️" />
        <Stat label="Plans" value={plans.length} tone="violet" icon="💎" />
      </div>

      {showChecklist && (
        <Card
          accent="emerald"
          title="🚀 Getting started"
          actions={
            <form action={dismissChecklist}>
              <button className="text-xs text-slate-500 hover:text-slate-800">Hide this</button>
            </form>
          }
        >
          <p className="mb-4 text-sm text-slate-600">New here? Follow these steps to launch your first store. Each step links to the right page.</p>
          <Checklist items={steps} />
        </Card>
      )}

      <Card title="Stores" accent="indigo">
        {instances.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-4xl">🏪</p>
            <p className="mt-2 text-sm text-slate-600">No stores yet. Create the first one to get started.</p>
            <Link href="/admin/instances/new" className={`${btnCls} mt-4`}>Create a store</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2">Store</th><th>Address</th><th>Plan</th><th>Owner</th><th>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {instances.map((i) => (
                  <tr key={String(i._id)} className="hover:bg-slate-50">
                    <td className="py-3">
                      <Link href={`/admin/instances/${i._id}`} className="flex items-center gap-2 font-semibold text-slate-900 hover:text-indigo-700">
                        <span className="h-3 w-3 rounded-full" style={{ background: i.branding?.primaryColor ?? "#4f46e5" }} />
                        {i.name}
                      </Link>
                    </td>
                    <td><a href={storeUrl(i.subdomain)} className="text-indigo-600 hover:underline" target="_blank">{i.customDomain || i.subdomain}</a></td>
                    <td><Badge tone="violet">{planName.get(String(i.plan)) ?? "—"}</Badge></td>
                    <td className="text-slate-600">{i.owner?.email}</td>
                    <td><Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
