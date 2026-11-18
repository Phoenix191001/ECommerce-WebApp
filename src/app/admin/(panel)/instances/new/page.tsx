import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans } from "@/lib/plans";
import { rootDomain } from "@/lib/subdomain";
import { Card } from "@/components/admin/ui";
import { InstanceForm } from "@/components/admin/forms";

export default async function NewInstancePage() {
  await ensurePlans();
  const { Plan } = platformModels(await platformDb());
  const plans = (await Plan.find().sort({ name: -1 }).lean()).map((p) => ({ id: String(p._id), name: p.name, description: p.description }));
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New store</h1>
        <p className="text-sm text-slate-500">Creates the store, its own database, and its owner account.</p>
      </div>
      <Card accent="violet">
        <InstanceForm plans={plans} rootDomain={rootDomain()} />
      </Card>
    </>
  );
}
