import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans } from "@/lib/plans";
import { Card } from "@/components/admin/ui";

export default async function PlansPage() {
  await ensurePlans();
  const { Plan } = platformModels(await platformDb());
  const plans = await Plan.find().sort({ name: 1 }).lean();
  const limit = (n?: number | null) => (n ? String(n) : "Unlimited");
  return (
    <>
      <h1 className="text-xl font-semibold text-gray-900">Plans</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={String(p._id)} title={p.name}>
            <p className="text-sm text-gray-600">{p.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Features included</dt><dd>{p.features.length}</dd>
              <dt className="text-gray-500">Products</dt><dd>{limit(p.maxProducts)}</dd>
              <dt className="text-gray-500">Staff</dt><dd>{limit(p.maxStaff)}</dd>
              <dt className="text-gray-500">Custom domains</dt><dd>{p.maxDomains ?? 0}</dd>
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
