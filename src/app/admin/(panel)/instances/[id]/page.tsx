import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { platformDb, instanceDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { tenantModels } from "@/lib/models/tenant";
import {
  DESCRIPTIONS, FEATURES, GROUP_LABELS, IMPLEMENTED, effectiveToggles, type FeatureGroup, type ToggleState,
} from "@/lib/features";
import { storeUrl } from "@/lib/subdomain";
import { formatMoney } from "@/lib/tenant";
import {
  changePlan, impersonateOwner, setInstanceStatus, setLimits, setToggle, setToggleLock,
} from "../../../actions";
import { Badge, Card, STATUS_TONE, Stat, btnSecondaryCls, inputCls } from "@/components/admin/ui";
import { AdminStarterPackButton, DeleteForm, OwnerLinkForm, ProductForm } from "@/components/admin/forms";
import { ToggleBoard } from "@/components/admin/toggles";

export default async function InstancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!Types.ObjectId.isValid(id)) notFound();
  const { Instance, Plan, AuditLog } = platformModels(await platformDb());
  const inst = await Instance.findById(id).lean();
  if (!inst) notFound();
  const m = tenantModels(await instanceDb(id));
  const [plan, plans, products, productCount, orderStats, customers, staff, owner, log] = await Promise.all([
    Plan.findById(inst.plan).lean(),
    Plan.find().sort({ name: -1 }).lean(),
    m.Product.find().sort({ createdAt: -1 }).limit(5).lean(),
    m.Product.countDocuments(),
    m.Order.aggregate<{ n: number; revenue: number }>([
      { $match: { status: { $nin: ["cancelled", "refunded"] } } },
      { $group: { _id: null, n: { $sum: 1 }, revenue: { $sum: "$total" } } },
    ]),
    m.User.countDocuments({ role: "customer" }),
    m.User.countDocuments({ role: { $in: ["manager", "cashier"] } }),
    m.User.findOne({ role: "owner" }).lean(),
    AuditLog.find({ instance: inst._id }).sort({ createdAt: -1 }).limit(20).lean(),
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
  const currency = inst.currency ?? "PKR";
  const stats = orderStats[0] ?? { n: 0, revenue: 0 };
  const ownerReady = !!owner?.passwordHash;

  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Store</p>
            <h1 className="text-2xl font-bold">{inst.name}</h1>
            <p className="mt-1 text-sm text-white/80">
              <a href={storeUrl(inst.subdomain)} target="_blank" className="underline decoration-white/40 hover:decoration-white">
                {inst.customDomain || inst.subdomain}
              </a>
              {" · "}{plan?.name ?? "No plan"} plan{" · "}Owner {inst.owner?.name} ({inst.owner?.email})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={storeUrl(inst.subdomain)} target="_blank" className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur hover:bg-white/25">🛒 Open store</a>
            <form action={impersonateOwner.bind(null, id)}>
              <button className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur hover:bg-white/25">🧑‍💼 Sign in as owner</button>
            </form>
            <form action={setInstanceStatus.bind(null, id, suspended ? "active" : "suspended")}>
              <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
                {suspended ? "▶️ Resume store" : "⏸️ Suspend store"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {created && (
        <Card accent="emerald" title="🎉 Store created — what's next?">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Create the <b>owner setup link</b> below and send it to {inst.owner?.name}. They'll set a password and get a setup wizard.</li>
            <li>The <b>starter pack</b> of features is already on. Adjust the switches below if this store needs more or less.</li>
            <li>Use <b>Sign in as owner</b> to see the store's panel yourself.</li>
          </ol>
        </Card>
      )}

      {suspended && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⏸️ This store is suspended. Customers see a maintenance page until you resume it.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Features on" value={onCount} tone="indigo" icon="🧩" />
        <Stat label="Products" value={productCount} tone="sky" icon="📦" />
        <Stat label="Orders" value={stats.n} tone="emerald" icon="🧾" />
        <Stat label="Revenue" value={formatMoney(stats.revenue, currency)} tone="amber" icon="💰" />
        <Stat label="Customers / staff" value={`${customers} / ${staff}`} tone="rose" icon="👥" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="🧑‍💼 Store owner" accent="sky">
          <p className="mb-3 text-sm text-slate-600">
            {ownerReady
              ? <>The owner has set a password and can sign in at <code className="rounded bg-slate-100 px-1">{storeUrl(inst.subdomain)}/manage</code>.</>
              : <>The owner hasn't set a password yet. Create a setup link and send it to <b>{inst.owner?.email}</b>.</>}
          </p>
          <OwnerLinkForm instanceId={id} />
        </Card>

        <Card title="💎 Plan and limits" accent="violet">
          <form action={changePlan.bind(null, id)} className="mb-4 flex gap-2">
            <select name="planId" defaultValue={String(inst.plan)} className={inputCls}>
              {plans.map((p) => <option key={String(p._id)} value={String(p._id)}>{p.name}</option>)}
            </select>
            <button className={btnSecondaryCls}>Change plan</button>
          </form>
          <form action={setLimits.bind(null, id)} className="grid grid-cols-3 gap-2 text-xs">
            {(["maxProducts", "maxStaff", "maxDomains"] as const).map((k) => (
              <label key={k} className="space-y-1">
                <span className="text-slate-600">{k === "maxProducts" ? "Products" : k === "maxStaff" ? "Staff" : "Domains"} (plan: {plan?.[k] || "∞"})</span>
                <input name={k} type="number" min="0" placeholder="Plan default" defaultValue={inst.limitOverrides?.[k] ?? ""} className={inputCls} />
              </label>
            ))}
            <button className={`${btnSecondaryCls} col-span-3`}>Save limit overrides</button>
          </form>
        </Card>
      </div>

      <Card
        title="🧩 Feature toggles"
        accent="indigo"
        actions={
          <AdminStarterPackButton instanceId={id} />
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          Switch a feature on and the store shows it within seconds. If it depends on other features, you'll be offered a one-click fix.
          🔒 Lock a switch so the store owner can't change it. Features marked <Badge tone="sky">Coming soon</Badge> are saved now and start working when they're built.
        </p>
        <ToggleBoard
          groups={groups}
          toggles={toggles}
          effective={effective}
          locked={inst.lockedToggles ?? []}
          planFeatures={plan?.features ?? []}
          descriptions={DESCRIPTIONS}
          implemented={[...IMPLEMENTED]}
          onToggle={setToggle.bind(null, id)}
          onLock={setToggleLock.bind(null, id)}
        />
      </Card>

      <Card title="📦 Products" accent="sky" actions={<Link href={`/s/${inst.subdomain}/manage/products`} className="text-sm text-indigo-600 hover:underline">Manage all →</Link>}>
        <ProductForm instanceId={id} />
        {products.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {products.map((p) => (
              <li key={String(p._id)} className="flex justify-between py-2">
                <span>{p.name}</span>
                <span className="text-slate-600">{formatMoney(p.price, currency)} · {p.stock} in stock</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="📜 Audit log" accent="amber">
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {log.map((e) => (
              <li key={String(e._id)} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <Badge tone={e.actorRole === "super_admin" ? "violet" : "sky"}>{e.action}</Badge>{" "}
                  {e.target}{" "}
                  {e.oldValue !== undefined && e.oldValue !== null && <span className="text-slate-500">{String(e.oldValue)} → {String(e.newValue)}</span>}
                </span>
                <span className="text-xs text-slate-500">{e.actor} · {new Date(e.createdAt as Date).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="⚠️ Data and deletion" accent="rose">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/admin/instances/${id}/export`} className={btnSecondaryCls}>⬇️ Download data export (JSON)</a>
            <span className="text-xs text-slate-500">
              {inst.exportedAt ? `Last export ${new Date(inst.exportedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}` : "Never exported"}
            </span>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-rose-700">Delete this store…</summary>
            <p className="my-2 text-sm text-slate-600">Deleting removes the store's database and all its data. Download an export first.</p>
            <DeleteForm instanceId={id} subdomain={inst.subdomain} />
          </details>
          <Badge tone={STATUS_TONE[inst.status]}>{inst.status}</Badge>
        </div>
      </Card>
    </>
  );
}
