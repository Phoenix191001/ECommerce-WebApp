import Link from "next/link";
import { getStore, storeModels, formatMoney } from "@/lib/tenant";
import { AddToCart } from "@/components/store/cart";

type Props = {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ q?: string; cat?: string; brand?: string; min?: string; max?: string; sort?: string; stock?: string }>;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function StoreHome({ params, searchParams }: Props) {
  const { site } = await params;
  const sp = await searchParams;
  const store = (await getStore(site))!;
  const f = store.features;
  const b = store.base;

  const hero = (
    <section className="bg-brand-gradient relative overflow-hidden text-white">
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="relative mx-auto max-w-6xl px-4 py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Welcome to</p>
        <h1 className="mt-1 text-4xl font-extrabold sm:text-5xl">{store.name}</h1>
        {store.branding.tagline && <p className="mt-3 max-w-xl text-lg text-white/90">{store.branding.tagline}</p>}
        {f["F-58"] && store.settings.freeShippingThreshold > 0 && (
          <p className="mt-5 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur">
            🚚 Free delivery on orders over {formatMoney(store.settings.freeShippingThreshold, store.currency)}
          </p>
        )}
      </div>
    </section>
  );

  if (!f["F-01"]) return hero;

  const { Product } = await storeModels(store);
  const filter: Record<string, unknown> = { status: "active" };
  const search = f["F-05"] && sp.q?.trim() ? sp.q.trim().slice(0, 100) : "";
  if (search) filter.$or = [{ name: { $regex: escapeRegex(search), $options: "i" } }, { description: { $regex: escapeRegex(search), $options: "i" } }];
  if (f["F-06"] && sp.cat) filter.category = sp.cat;
  if (f["F-07"] && sp.brand) filter.brand = sp.brand;
  if (f["F-05"]) {
    const price: Record<string, number> = {};
    if (sp.min && !isNaN(+sp.min)) price.$gte = +sp.min;
    if (sp.max && !isNaN(+sp.max)) price.$lte = +sp.max;
    if (Object.keys(price).length) filter.price = price;
    if (sp.stock === "1") filter.stock = { $gt: 0 };
  }
  const sort: Record<string, 1 | -1> =
    sp.sort === "price_asc" ? { price: 1 } : sp.sort === "price_desc" ? { price: -1 } : sp.sort === "rating" ? { ratingAvg: -1 } : { createdAt: -1 };

  const [products, categories, brands] = await Promise.all([
    Product.find(filter).sort(sort).limit(60).lean(),
    f["F-06"] ? Product.distinct("category", { status: "active", category: { $ne: "" } }) : Promise.resolve([]),
    f["F-07"] ? Product.distinct("brand", { status: "active", brand: { $ne: "" } }) : Promise.resolve([]),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const all = { ...sp, ...patch };
    for (const [k, v] of Object.entries(all)) if (v) u.set(k, v);
    const s = u.toString();
    return `${b || "/"}${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${active ? "bg-brand border-brand text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`;

  return (
    <>
      {hero}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {(categories.length > 0 || brands.length > 0) && (
          <div className="mb-6 space-y-3">
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Link href={qs({ cat: undefined })} className={chip(!sp.cat)}>All</Link>
                {categories.map((c) => <Link key={c} href={qs({ cat: c })} className={chip(sp.cat === c)}>{c}</Link>)}
              </div>
            )}
            {brands.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm">
                <span className="text-slate-500">Brands:</span>
                {brands.map((x) => <Link key={x} href={qs({ brand: sp.brand === x ? undefined : x })} className={chip(sp.brand === x)}>{x}</Link>)}
              </div>
            )}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">{search ? `Results for “${search}”` : sp.cat || "All products"}</h2>
          {f["F-05"] && (
            <form className="flex flex-wrap items-end gap-2 text-sm" role="search">
              {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
              {sp.brand && <input type="hidden" name="brand" value={sp.brand} />}
              <input name="q" defaultValue={search} placeholder="Search…" aria-label="Search products" className="ring-brand w-40 rounded-xl border border-slate-300 bg-white px-3 py-2" />
              <input name="min" defaultValue={sp.min} placeholder="Min" inputMode="numeric" aria-label="Minimum price" className="ring-brand w-20 rounded-xl border border-slate-300 bg-white px-3 py-2" />
              <input name="max" defaultValue={sp.max} placeholder="Max" inputMode="numeric" aria-label="Maximum price" className="ring-brand w-20 rounded-xl border border-slate-300 bg-white px-3 py-2" />
              <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort" className="ring-brand rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                {f["F-04"] && <option value="rating">Top rated</option>}
              </select>
              <label className="flex items-center gap-1 py-2"><input type="checkbox" name="stock" value="1" defaultChecked={sp.stock === "1"} /> In stock</label>
              <button className="btn-brand !py-2">Filter</button>
            </form>
          )}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-2 text-slate-600">{search || sp.cat || sp.brand ? "No products match. Try clearing the filters." : "No products yet. Check back soon!"}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const out = f["F-17"] && p.stock <= 0;
              const sale = p.compareAtPrice && p.compareAtPrice > p.price;
              return (
                <li key={String(p._id)} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <Link href={`${b}/p/${p.slug}`} className="relative block">
                    <div className="bg-brand-soft aspect-square overflow-hidden">
                      {p.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-5xl" aria-hidden>🛍️</div>
                      )}
                    </div>
                    {sale && <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">Sale</span>}
                    {out && <span className="absolute right-2 top-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">Sold out</span>}
                  </Link>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <Link href={`${b}/p/${p.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">{p.name}</Link>
                    {f["F-04"] && p.ratingCount > 0 && (
                      <p className="text-xs text-amber-500">{"★".repeat(Math.round(p.ratingAvg))}<span className="text-slate-400"> ({p.ratingCount})</span></p>
                    )}
                    <p className="mt-auto text-sm">
                      <b className="text-brand">{formatMoney(p.price, store.currency)}</b>
                      {sale && <s className="ml-2 text-xs text-slate-400">{formatMoney(p.compareAtPrice!, store.currency)}</s>}
                    </p>
                    <AddToCart site={site} product={String(p._id)} disabled={out} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
