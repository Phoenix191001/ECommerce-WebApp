import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { storeModels, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card } from "@/components/admin/ui";
import { ProductEditor } from "@/components/manage/forms";
import { deleteProduct } from "../../../manage-actions";
import { editorExtras } from "@/lib/editor-extras";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params }: { params: Promise<{ site: string; id: string }> }) {
  const { site, id } = await params;
  const store = await requireStore(site);
  const user = await requireStaff(store, "catalog", { seller: true });
  if (!Types.ObjectId.isValid(id)) notFound();
  const m = await storeModels(store);
  const [p, categories] = await Promise.all([m.Product.findById(id).lean(), m.Product.distinct("category", { category: { $ne: "" } })]);
  if (!p || (user.role === "seller" && String(p.seller) !== String(user.sellerId))) notFound();
  const extras = await editorExtras(store, m, user);
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{p.name}</h1>
        <a href={`${store.base}/p/${p.slug}`} target="_blank" className="text-sm text-emerald-700 hover:underline">View in store ↗</a>
      </div>
      <Card accent="emerald">
        <ProductEditor
          site={site}
          categories={categories}
          features={store.features}
          uploadUrl={`${store.base}/manage/upload`}
          storeId={store.id}
          catalog={extras.catalog}
          sellers={extras.sellers}
          product={{
            id, name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, stock: p.stock, category: p.category, brand: p.brand,
            sku: p.sku, barcode: p.barcode, images: p.images, description: p.description, status: p.status,
            optionNames: p.optionNames, variants: (p.variants ?? []).map((v) => ({ name: v.name, price: v.price ?? undefined, stock: v.stock, sku: v.sku, barcode: v.barcode })),
            tags: p.tags, publishAt: p.publishAt?.toISOString(), warrantyMonths: p.warrantyMonths, sizeGuide: p.sizeGuide,
            volumeTiers: (p.volumeTiers ?? []).map((t) => ({ minQty: t.minQty, price: t.price })), salePrice: p.salePrice ?? undefined,
            saleEndsAt: p.saleEndsAt?.toISOString(), costPrice: p.costPrice, wholesalePrice: p.wholesalePrice ?? undefined,
            kind: p.kind, digitalFile: p.digitalFile?.url ? { url: p.digitalFile.url, name: p.digitalFile.name } : undefined,
            bundle: (p.bundle ?? []).map((b) => ({ product: String(b.product), qty: b.qty })),
            customFields: (p.customFields ?? []).map((c) => ({ label: c.label, required: c.required, maxLength: c.maxLength })),
            upsells: (p.upsells ?? []).map(String), seller: p.seller ? String(p.seller) : undefined,
          }}
        />
      </Card>
      <Card accent="rose">
        <form action={deleteProduct.bind(null, site, id)} className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Delete this product. Past orders keep their copy of it.</p>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">Delete</button>
        </form>
      </Card>
    </>
  );
}
