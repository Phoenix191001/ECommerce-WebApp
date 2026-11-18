import { getStore, storeModels, formatMoney } from "@/lib/tenant";

type Props = { params: Promise<{ site: string }>; searchParams: Promise<{ q?: string }> };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function StoreHome({ params, searchParams }: Props) {
  const { site } = await params;
  const { q } = await searchParams;
  const store = (await getStore(site))!; // layout already handled not-found

  if (!store.features["F-01"]) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        {store.branding.tagline && <p className="mt-2 text-gray-600">{store.branding.tagline}</p>}
      </main>
    );
  }

  const { Product } = await storeModels(store);
  const search = store.features["F-05"] && q?.trim() ? q.trim().slice(0, 100) : "";
  const filter: Record<string, unknown> = { status: "active" };
  if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
  const products = await Product.find(filter).sort({ createdAt: -1 }).limit(48).lean();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{search ? `Results for "${search}"` : "All products"}</h1>
          {store.branding.tagline && <p className="text-gray-600">{store.branding.tagline}</p>}
        </div>
        {store.features["F-05"] && (
          <form className="w-full sm:w-72" role="search">
            <label className="sr-only" htmlFor="q">Search products</label>
            <input id="q" name="q" defaultValue={search} placeholder="Search products…" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </form>
        )}
      </div>
      {products.length === 0 ? (
        <p className="py-16 text-center text-gray-500">{search ? "No products match your search." : "No products yet. Check back soon."}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={String(p._id)} className="group">
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl text-gray-300" aria-hidden>🛍️</div>
                )}
              </div>
              <h2 className="mt-2 text-sm font-medium">{p.name}</h2>
              <p className="text-sm text-gray-700">{formatMoney(p.price, store.currency)}</p>
              {store.features["F-17"] && p.stock <= 0 && <p className="text-xs text-red-600">Out of stock</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
