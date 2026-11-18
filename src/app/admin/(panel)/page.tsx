import Link from "next/link";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans } from "@/lib/plans";
import { storeUrl } from "@/lib/subdomain";
import { Card, btnCls } from "@/components/admin/ui";

export default async function InstancesPage() {
  await ensurePlans();
  const { Instance, Plan } = platformModels(await platformDb());
  const [instances, plans] = await Promise.all([
    Instance.find().sort({ createdAt: -1 }).limit(200).lean(),
    Plan.find().lean(),
  ]);
  const planName = new Map(plans.map((p) => [String(p._id), p.name]));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Instances</h1>
        <Link href="/admin/instances/new" className={btnCls}>New instance</Link>
      </div>
      <Card>
        {instances.length === 0 ? (
          <p className="text-sm text-gray-500">No instances yet. Create the first store to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr><th className="py-2">Store</th><th>Subdomain</th><th>Plan</th><th>Owner</th><th>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {instances.map((i) => (
                  <tr key={String(i._id)}>
                    <td className="py-2.5">
                      <Link href={`/admin/instances/${i._id}`} className="font-medium text-gray-900 hover:underline">{i.name}</Link>
                    </td>
                    <td><a href={storeUrl(i.subdomain)} className="text-gray-600 hover:underline" target="_blank">{i.subdomain}</a></td>
                    <td>{planName.get(String(i.plan)) ?? "—"}</td>
                    <td className="text-gray-600">{i.owner?.email}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${i.status === "active" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {i.status}
                      </span>
                    </td>
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
