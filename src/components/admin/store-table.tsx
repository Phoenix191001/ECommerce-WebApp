import Link from "next/link";
import { storeUrl } from "@/lib/subdomain";
import { Badge, STATUS_TONE, btnCls } from "./ui";

type Row = { _id: unknown; name: string; subdomain: string; customDomain?: string | null; status: string; plan?: unknown; owner?: { email?: string } | null; branding?: { primaryColor?: string } | null };

/** Table of stores for the Super Admin dashboard and store list. */
export function StoreTable({ instances, planName, empty }: { instances: Row[]; planName: Map<string, string>; empty?: string }) {
  if (instances.length === 0)
    return (
      <div className="py-8 text-center">
        <p className="text-4xl">🏪</p>
        <p className="mt-2 text-sm text-slate-600">{empty ?? "No stores yet. Create the first one to get started."}</p>
        {!empty && <Link href="/admin/instances/new" className={`${btnCls} mt-4`}>Create a store</Link>}
      </div>
    );
  return (
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
  );
}
