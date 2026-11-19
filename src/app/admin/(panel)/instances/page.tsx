import Link from "next/link";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { requireAdmin } from "@/lib/auth";
import { Card, btnCls } from "@/components/admin/ui";
import { StoreTable } from "@/components/admin/store-table";

export const metadata = { title: "Stores" };

const TITLES = { all: "🏬 All stores", active: "✅ Active stores", suspended: "⏸️ Suspended stores" } as const;

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const key = status === "active" || status === "suspended" ? status : "all";
  const { Instance, Plan } = platformModels(await platformDb());
  const filter: Record<string, unknown> = key === "all" ? {} : { status: key };
  const term = q?.trim().slice(0, 60);
  if (term) {
    const rx = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ name: rx }, { subdomain: rx }, { "owner.email": rx }, { customDomain: rx }];
  }
  const [instances, plans] = await Promise.all([Instance.find(filter).sort({ createdAt: -1 }).limit(500).lean(), Plan.find().lean()]);
  const planName = new Map(plans.map((p) => [String(p._id), p.name]));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{TITLES[key]}</h1>
        <Link href="/admin/instances/new" className={btnCls}>➕ New store</Link>
      </div>
      <Card accent={key === "suspended" ? "amber" : key === "active" ? "emerald" : "indigo"}>
        <form className="mb-4 flex gap-2">
          {key !== "all" && <input type="hidden" name="status" value={key} />}
          <input name="q" defaultValue={term} placeholder="Search by store name, address or owner email…" className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </form>
        <StoreTable
          instances={instances}
          planName={planName}
          empty={term ? "No stores match that search." : key === "suspended" ? "No suspended stores. 👍" : key === "active" ? "No active stores yet." : undefined}
        />
      </Card>
    </>
  );
}
