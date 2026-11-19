import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { storePrefs } from "@/lib/store-prefs";
import { visibleFilter } from "@/lib/pricing";
import { ProductCard } from "@/components/store/product-card";
import { displayCurrency } from "@/lib/currency";

// F-07 brand pages.
export default async function BrandPage({ params }: { params: Promise<{ site: string; brand: string }> }) {
  const { site, brand: raw } = await params;
  const brand = decodeURIComponent(raw);
  const store = await requireStore(site);
  if (!store.features["F-07"] || !store.features["F-01"]) notFound();
  const { t } = await storePrefs(store);
  const cur = await displayCurrency(store);
  const products = await (await storeModels(store)).Product.find({ $and: [visibleFilter(store.features), { brand }] }).sort({ createdAt: -1 }).limit(120).lean();
  if (!products.length) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="bg-brand-gradient mb-8 rounded-3xl p-8 text-white">
        <p className="text-sm uppercase tracking-widest text-white/80">{t.brands}</p>
        <h1 className="text-4xl font-extrabold">{brand}</h1>
        <p className="mt-1 text-white/85">{products.length} products</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => <ProductCard cur={cur} key={String(p._id)} p={p} site={site} base={store.base} currency={store.currency} f={store.features} L={t} />)}
      </ul>
    </main>
  );
}
