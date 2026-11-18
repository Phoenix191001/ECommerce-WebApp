import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { platformDb, instanceDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { tenantModels } from "@/lib/models/tenant";
import { FEATURES, GROUP_LABELS, effectiveToggles, type FeatureGroup, type ToggleState } from "@/lib/features";
import { storeUrl } from "@/lib/subdomain";
import { formatMoney } from "@/lib/tenant";
import { setInstanceStatus } from "../../../actions";
import { Card, btnSecondaryCls } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/forms";
import { ToggleBoard } from "@/components/admin/toggles";

export default async function InstancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  const { Instance, Plan, AuditLog } = platformModels(await platformDb());
  const inst = await Instance.findById(id).lean();
  if (!inst) notFound();
  const { Product } = tenantModels(await instanceDb(id));
  const [plan, products, productCount, log] = await Promise.all([
    Plan.findById(inst.plan).lean(),
    Product.find().sort({ createdAt: -1 }).limit(10).lean(),
    Product.countDocuments(),
    AuditLog.find({ instance: inst._id }).sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  const toggles = Object.fromEntries(Object.entries(inst.toggles ?? {})) as ToggleState;
  const effective = effectiveToggles(toggles);
  const groups = (Object.keys(GROUP_LABELS) as FeatureGroup[]).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    features: FEATURES.filter((f) => f.group === g),
  }));
  const onCount = Object.values(effective).filter(Boolean).length;
  const suspended = inst.status === "suspended";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{inst.name}</h1>
          <p className="text-sm text-gray-500">
            <a href={storeUrl(inst.subdomain)} target="_blank" className="hover:underline">{inst.subdomain}</a>
            {" · "}{plan?.name ?? "No plan"}{" · "}Owner {inst.owner?.name} ({inst.owner?.email})
          </p>
        </div>
        <form action={setInstanceStatus.bind(null, id, suspended ? "active" : "suspended")}>
          <button className={btnSecondaryCls}>{suspended ? "Resume store" : "Suspend store"}</button>
        </form>
      </div>

      {suspended && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This store is suspended. Customers see a maintenance page until you resume it.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-xs text-gray-500">Active features</p><p className="text-2xl font-semibold">{onCount}</p></Card>
        <Card><p className="text-xs text-gray-500">Products</p><p className="text-2xl font-semibold">{productCount}</p></Card>
        <Card><p className="text-xs text-gray-500">Status</p><p className="text-2xl font-semibold capitalize">{inst.status}</p></Card>
      </div>

      <Card title="Products">
        <ProductForm instanceId={id} />
        {products.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {products.map((p) => (
              <li key={String(p._id)} className="flex justify-between py-2">
                <span>{p.name}</span>
                <span className="text-gray-600">{formatMoney(p.price, inst.currency ?? "PKR")} · {p.stock} in stock</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Feature toggles">
        <ToggleBoard
          instanceId={id}
          groups={groups}
          toggles={toggles}
          effective={effective}
          locked={inst.lockedToggles ?? []}
          planFeatures={plan?.features ?? []}
        />
      </Card>

      <Card title="Audit log">
        {log.length === 0 ? (
          <p className="text-sm text-gray-500">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {log.map((e) => (
              <li key={String(e._id)} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-mono text-xs text-gray-500">{e.action}</span>{" "}
                  {e.target}{" "}
                  {e.oldValue !== undefined && <span className="text-gray-500">{String(e.oldValue)} → {String(e.newValue)}</span>}
                </span>
                <span className="text-xs text-gray-500">{e.actor} · {new Date(e.createdAt as Date).toLocaleString("en-GB")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
