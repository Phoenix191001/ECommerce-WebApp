import Link from "next/link";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans } from "@/lib/plans";
import { requireAdmin } from "@/lib/auth";
import { Card, Checklist, btnCls } from "@/components/admin/ui";
import { StoreTable } from "@/components/admin/store-table";
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

      <Card title="Stores" accent="indigo" actions={<Link href="/admin/instances" className="text-sm text-indigo-700 hover:underline">All stores →</Link>}>
        <StoreTable instances={instances.slice(0, 10)} planName={planName} />
      </Card>
    </>
  );
}
