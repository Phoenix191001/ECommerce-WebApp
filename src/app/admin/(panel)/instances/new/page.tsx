import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans } from "@/lib/plans";
import { rootDomain } from "@/lib/subdomain";
import { Card } from "@/components/admin/ui";
import { InstanceForm } from "@/components/admin/forms";

export default async function NewInstancePage() {
  await ensurePlans();
  const { Plan } = platformModels(await platformDb());
  const plans = (await Plan.find().sort({ name: 1 }).lean()).map((p) => ({ id: String(p._id), name: p.name }));
  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900">New instance</h1>
      <Card>
        <InstanceForm plans={plans} rootDomain={rootDomain()} />
      </Card>
    </>
  );
}
