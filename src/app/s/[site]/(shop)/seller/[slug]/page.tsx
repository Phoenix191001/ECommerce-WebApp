import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { storePrefs } from "@/lib/store-prefs";
import { visibleFilter } from "@/lib/pricing";
import { displayCurrency } from "@/lib/currency";
import { ProductCard } from "@/components/store/product-card";

// F-67: a marketplace seller's page in the store.
export default async function SellerPage({ params }: { params: Promise<{ site: string; slug: string }> }) {
  const { site, slug } = await params;
  const store = await requireStore(site);
  if (!store.features["F-67"]) notFound();
  const m = await storeModels(store);
  const seller = await m.Seller.findOne({ slug, status: "active" }).lean();
  if (!seller) notFound();
  const [{ t }, cur, products] = await Promise.all([
    storePrefs(store), displayCurrency(store),
    m.Product.find({ ...visibleFilter(store.features), seller: seller._id }).sort({ createdAt: -1 }).limit(60).lean(),
  ]);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{t.soldBy}</p>
        <h1 className="text-3xl font-bold">🏪 {seller.name}</h1>
        {seller.about && <p className="mt-2 max-w-2xl whitespace-pre-line text-slate-600">{seller.about}</p>}
      </div>
      {products.length === 0 ? <p className="text-slate-500">{t.noProducts}</p> : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((p) => <ProductCard key={String(p._id)} p={p} site={site} base={store.base} currency={store.currency} f={store.features} L={t} cur={cur} />)}
        </ul>
      )}
    </main>
  );
}
