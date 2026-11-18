import Link from "next/link";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { totalStock } from "@/lib/pricing";
import { Badge, Card, btnTealCls } from "@/components/admin/ui";
import { fill } from "@/lib/i18n";
import { panelPrefs, pText } from "@/lib/panel-i18n";

export const metadata = { title: "Products" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function Products({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string; saved?: string }> }) {
  const { site } = await params;
  const { q, saved } = await searchParams;
  const store = await requireStore(site);
  await requireStaff(store, "catalog");
  const m = await storeModels(store);
  const filter = q ? { $or: [{ name: { $regex: esc(q), $options: "i" } }, { sku: q }, { barcode: q }] } : {};
  const products = await m.Product.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const b = `${store.base}/manage`;
  const f = store.features;
  const { p: L } = await panelPrefs(store);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{L.products}</h1>
        <div className="flex gap-2">
          {f["F-50"] && <a href={`${b}/export/products`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">{L.exportCsv}</a>}
          {(f["F-90"] || f["F-91"]) && <Link href={`${b}/products/bulk`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">{L.bulk}</Link>}
          {f["F-65"] && <Link href={`${b}/questions`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">{L.questions}</Link>}
          <Link href={`${b}/products/new`} className={btnTealCls}>{L.addProduct}</Link>
        </div>
      </div>
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{L.productSaved}</p>}
      <Card>
        <form className="mb-4"><input name="q" defaultValue={q} placeholder={L.searchProducts} className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" /></form>
        {products.length === 0 ? (
          <div className="py-10 text-center"><p className="text-4xl">📦</p><p className="mt-2 text-sm text-slate-600">{L.noProducts}</p><Link href={`${b}/products/new`} className={`${btnTealCls} mt-4`}>{L.addFirst}</Link></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 text-start">{L.colProduct}</th><th className="text-start">{L.colPrice}</th>{f["F-17"] && <th className="text-start">{L.colStock}</th>}<th className="text-start">{L.colCategory}</th><th className="text-start">{L.colStatus}</th></tr></thead>
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
                    {f["F-17"] && (() => { const st = totalStock(p); return <td className={st <= 0 ? "font-semibold text-rose-600" : st <= store.settings.lowStockAt ? "text-amber-700" : ""}>{st}{p.variants?.length ? <span className="ms-1 text-xs text-slate-400">{fill(L.variants, { n: p.variants.length })}</span> : null}{p.publishAt && new Date(p.publishAt) > new Date() ? <span className="ms-1 text-xs text-sky-600">{L.scheduled}</span> : null}</td>; })()}
                    <td className="text-slate-600">{p.category || "—"}</td>
                    <td><Badge tone={p.status === "active" ? "green" : "slate"}>{pText(L, "ps", p.status)}</Badge></td>
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
