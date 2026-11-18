import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans } from "@/lib/plans";
import { FEATURES, GROUP_LABELS, type FeatureGroup } from "@/lib/features";
import { Badge, Card } from "@/components/admin/ui";
import { PlanForm } from "@/components/admin/forms";

export default async function PlansPage() {
  await ensurePlans();
  const { Plan, Instance } = platformModels(await platformDb());
  const plans = await Plan.find().sort({ name: -1 }).lean();
  const counts = new Map(
    (await Instance.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$plan", n: { $sum: 1 } } }])).map((c) => [String(c._id), c.n]),
  );
  const groups = (Object.keys(GROUP_LABELS) as FeatureGroup[]).map((g) => ({
    label: GROUP_LABELS[g],
    features: FEATURES.filter((f) => f.group === g).map((f) => ({ id: f.id, name: f.name })),
  }));
  const tones = ["indigo", "emerald", "amber", "rose", "sky", "violet"] as const;
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plans</h1>
        <p className="text-sm text-slate-500">
          A plan decides which features a store can use. Store owners can only switch on features their plan includes.
        </p>
      </div>
      {plans.map((p, i) => (
        <Card
          key={String(p._id)}
          accent={tones[i % tones.length]}
          title={<span className="flex items-center gap-2">💎 {p.name} <Badge tone="slate">{counts.get(String(p._id)) ?? 0} stores</Badge></span>}
        >
          <PlanForm
            groups={groups}
            plan={{
              id: String(p._id), name: p.name, description: p.description, priceMonthly: p.priceMonthly,
              features: p.features, maxProducts: p.maxProducts, maxStaff: p.maxStaff, maxDomains: p.maxDomains,
            }}
          />
        </Card>
      ))}
      <Card title="➕ New plan" accent="sky">
        <PlanForm groups={groups} />
      </Card>
    </>
  );
}
