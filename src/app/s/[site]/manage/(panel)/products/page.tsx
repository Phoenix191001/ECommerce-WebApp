import Link from "next/link";
import { getStore, storeModels, formatMoney } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card, btnTealCls } from "@/components/admin/ui";

export const metadata = { title: "Products" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function Products({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string; saved?: string }> }) {
  const { site } = await params;
  const { q, saved } = await searchParams;
  const store = (await getStore(site))!;
  await requireStaff(store, "catalog");
  const m = await storeModels(store);
  const filter = q ? { $or: [{ name: { $regex: esc(q), $options: "i" } }, { sku: q }, { barcode: q }] } : {};
  const products = await m.Product.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const b = `${store.base}/manage`;
  const f = store.features;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <div className="flex gap-2">
          {f["F-50"] && <a href={`${b}/export/products`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">⬇️ Export CSV</a>}
          <Link href={`${b}/products/new`} className={btnTealCls}>➕ Add product</Link>
        </div>
      </div>
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ Product saved.</p>}
      <Card>
        <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search by name, SKU, or barcode…" className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" /></form>
        {products.length === 0 ? (
          <div className="py-10 text-center"><p className="text-4xl">📦</p><p className="mt-2 text-sm text-slate-600">No products yet.</p><Link href={`${b}/products/new`} className={`${btnTealCls} mt-4`}>Add your first product</Link></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Product</th><th>Price</th>{f["F-17"] && <th>Stock</th>}<th>Category</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={String(p._id)} className="hover:bg-slate-50">
                    <td className="py-2.5">
                      <Link href={`${b}/products/${p._id}`} className="flex items-center gap-3 font-medium text-slate-900 hover:text-emerald-700">
                        <span className="bg-brand-soft flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : "🛍️"}
                        </span>
                        {p.name}
                      </Link>
                    </td>
                    <td>{formatMoney(p.price, store.currency)}</td>
                    {f["F-17"] && <td className={p.stock <= 0 ? "font-semibold text-rose-600" : p.stock <= store.settings.lowStockAt ? "text-amber-700" : ""}>{p.stock}</td>}
                    <td className="text-slate-600">{p.category || "—"}</td>
                    <td><Badge tone={p.status === "active" ? "green" : "slate"}>{p.status}</Badge></td>
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
