import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card } from "@/components/admin/ui";
import { BulkEditForm, CsvImportForm } from "@/components/manage/catalog-forms";

export const metadata = { title: "Bulk edit" };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function Bulk({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string }> }) {
  const { site } = await params;
  const { q } = await searchParams;
  const store = await requireStore(site);
  await requireStaff(store, "catalog");
  const f = store.features;
  const m = await storeModels(store);
  const products = await m.Product.find(q ? { name: { $regex: esc(q), $options: "i" } } : {}).sort({ name: 1 }).limit(300).lean();
  type Row = { id: string; vid?: string; name: string; price?: number; inherited?: number; stock: number };
  const rows = products.flatMap((p): Row[] =>
    f["F-02"] && p.variants?.length
      ? p.variants.map((v) => ({ id: String(p._id), vid: String(v._id), name: `${p.name} — ${v.name}`, price: v.price ?? undefined, inherited: v.price == null ? p.price : undefined, stock: v.stock }))
      : [{ id: String(p._id), name: p.name, price: p.price, stock: p.stock }],
  );
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Bulk edit and import</h1>
      {f["F-90"] && (
        <Card title="📥 Import from CSV" accent="sky">
          <p className="mb-3 text-sm text-slate-600">
            Columns: <code className="text-xs">name, price</code> (required) and any of <code className="text-xs">slug, sku, stock, compare_at_price, cost_price, wholesale_price, category, brand, barcode, description, status, images, tags</code>.
            Rows with a matching slug or SKU update the existing product; others are added. The Products page&apos;s CSV export uses the same format.
          </p>
          <CsvImportForm site={site} />
        </Card>
      )}
      {f["F-91"] && (
        <Card title="✏️ Edit prices and stock" accent="emerald">
          <form className="mb-3"><input name="q" defaultValue={q} placeholder="Filter by name…" className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" /></form>
          {rows.length === 0 ? <p className="text-sm text-slate-500">No products.</p> : <BulkEditForm site={site} rows={rows} ids={products.map((p) => String(p._id)).join(",")} currency={store.currency} />}
        </Card>
      )}
    </>
  );
}
