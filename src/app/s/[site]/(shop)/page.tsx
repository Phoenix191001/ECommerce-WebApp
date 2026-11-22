import Link from "next/link";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { requireStore, storeModels, formatMoney } from "@/lib/tenant";
import { storePrefs } from "@/lib/store-prefs";
import { visibleFilter } from "@/lib/pricing";
import { fuzzyScore } from "@/lib/fuzzy";
import { ProductCard } from "@/components/store/product-card";
import { abVariants } from "@/lib/ab";
import { displayCurrency } from "@/lib/currency";
import { Blocks } from "@/components/store/blocks";
import { cleanBlocks } from "@/lib/blocks";
import { storeTheme } from "@/lib/theme";

type Props = {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ q?: string; cat?: string; brand?: string; tag?: string; min?: string; max?: string; sort?: string; stock?: string }>;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function StoreHome({ params, searchParams }: Props) {
  const { site } = await params;
  const sp = await searchParams;
  const store = await requireStore(site);
  const f = store.features;
  const b = store.base;
  const { t } = await storePrefs(store);
  const plain = !Object.values(sp).some(Boolean);
  // F-78: tested headline / banner image for this visitor's bucket (views counted on the plain home page only).
  const ab = f["F-78"] ? await abVariants(await storeModels(store), plain) : {};
  const tagline = ab.headline ?? store.branding.tagline;
  const cur = await displayCurrency(store);
  // F-116: a built page can replace the home page (search and filters still show the product grid).
  if (f["F-116"] && f["F-40"] && store.settings.homePage && plain) {
    const pg = await (await storeModels(store)).Page.findOne({ slug: store.settings.homePage, published: true }).lean();
    const blocks = pg ? cleanBlocks(pg.blocks) : [];
    if (blocks.length) return <main className="pb-8"><Blocks blocks={blocks} store={store} site={site} L={t} cur={cur} /></main>;
  }

  const theme = storeTheme(store);
  const heroImg = ab.hero ?? (theme?.heroImage || "");
  const centered = theme?.heroAlign === "center";
  const hero = (
    <section className={`${theme ? "st-hero" : "bg-brand-gradient"} relative overflow-hidden text-white ${centered ? "text-center" : ""}`} style={heroImg ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url("${encodeURI(heroImg)}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <div className="absolute -end-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 start-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="relative mx-auto max-w-6xl px-4 py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/80">{t.welcomeTo}</p>
        <h1 className="mt-1 text-4xl font-extrabold sm:text-5xl">{theme?.heroTitle || store.name}</h1>
        {(theme?.heroSubtitle || tagline) && <p className={`mt-3 max-w-xl text-lg text-white/90 ${centered ? "mx-auto" : ""}`}>{ab.headline ?? (theme?.heroSubtitle || tagline)}</p>}
        {theme?.heroButton && f["F-01"] && <a href="#products" className="st-hero-btn mt-5 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 shadow hover:brightness-95">{theme.heroButton}</a>}
        {f["F-58"] && store.settings.freeShippingThreshold > 0 && (
          <p className="mt-5 inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur">
            🚚 {t.freeDeliveryOver} {formatMoney(store.settings.freeShippingThreshold, store.currency)}
          </p>
        )}
      </div>
    </section>
  );

  if (!f["F-01"]) return hero;

  const { Product } = await storeModels(store);
  const and: Record<string, unknown>[] = [visibleFilter(f)];
  const search = f["F-05"] && sp.q?.trim() ? sp.q.trim().slice(0, 100) : "";
  if (search) and.push({ $or: [{ name: { $regex: escapeRegex(search), $options: "i" } }, { description: { $regex: escapeRegex(search), $options: "i" } }, { tags: search.toLowerCase() }] });
  if (f["F-06"] && sp.cat) and.push({ category: sp.cat });
  if (f["F-07"] && sp.brand) and.push({ brand: sp.brand });
  if (f["F-93"] && sp.tag) and.push({ tags: sp.tag.toLowerCase() });
  if (f["F-05"]) {
    const price: Record<string, number> = {};
    if (sp.min && !isNaN(+sp.min)) price.$gte = +sp.min;
    if (sp.max && !isNaN(+sp.max)) price.$lte = +sp.max;
    if (Object.keys(price).length) and.push({ price });
    if (sp.stock === "1") and.push({ $or: [{ stock: { $gt: 0 } }, { "variants.stock": { $gt: 0 } }] });
  }
  const sort: Record<string, 1 | -1> =
    sp.sort === "price_asc" ? { price: 1 } : sp.sort === "price_desc" ? { price: -1 } : sp.sort === "rating" ? { ratingAvg: -1 } : { createdAt: -1 };

  const jar = await cookies();
  const recentIds = f["F-09"] ? (jar.get(`rv_${store.id}`)?.value ?? "").split(",").filter((x) => Types.ObjectId.isValid(x)).slice(0, 8) : [];
  const [products0, categories, brands, tags, recent0] = await Promise.all([
    Product.find({ $and: and }).sort(sort).limit(60).lean(),
    f["F-06"] ? Product.distinct("category", { status: "active", category: { $ne: "" } }) : Promise.resolve([]),
    f["F-07"] ? Product.distinct("brand", { status: "active", brand: { $ne: "" } }) : Promise.resolve([]),
    f["F-93"] ? Product.distinct("tags", { status: "active" }) : Promise.resolve([]),
    recentIds.length && !search ? Product.find({ $and: [visibleFilter(f), { _id: { $in: recentIds } }] }).lean() : Promise.resolve([]),
  ]);

  let products = products0;
  let recent = recent0;
  // F-96: nothing matched exactly, so look for close spellings.
  let fuzzy = false;
  if (search && !products.length && f["F-96"]) {
    const pool = await Product.find({ $and: [visibleFilter(f)] }, { name: 1, slug: 1, price: 1, compareAtPrice: 1, images: 1, stock: 1, ratingAvg: 1, ratingCount: 1, variants: 1, salePrice: 1, saleEndsAt: 1, tags: 1, brand: 1 }).limit(2000).lean();
    products = pool
      .map((p) => ({ p, s: Math.min(fuzzyScore(search, p.name), fuzzyScore(search, `${p.brand ?? ""} ${(p.tags ?? []).join(" ")}`)) }))
      .filter((x) => x.s < Infinity)
      .sort((a, b) => a.s - b.s)
      .slice(0, 24)
      .map((x) => x.p) as typeof products;
    fuzzy = products.length > 0;
  }
  recent = recentIds.map((id) => recent.find((p) => String(p._id) === id)).filter(Boolean) as typeof recent;

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) u.set(k, v);
    const s = u.toString();
    return `${b || "/"}${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${active ? "bg-brand border-brand text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`;

  return (
    <>
      {hero}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {(categories.length > 0 || brands.length > 0 || tags.length > 0) && (
          <div className="mb-6 space-y-3">
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Link href={qs({ cat: undefined })} className={chip(!sp.cat)}>{t.all}</Link>
                {categories.map((c) => <Link key={c} href={qs({ cat: c })} className={chip(sp.cat === c)}>{c}</Link>)}
              </div>
            )}
            {brands.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm">
                <span className="text-slate-500">{t.brands}:</span>
                {brands.map((x) => <Link key={x} href={`${b}/brand/${encodeURIComponent(x)}`} className={chip(sp.brand === x)}>{x}</Link>)}
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm">
                <span className="text-slate-500">{t.tags}:</span>
                {tags.slice(0, 20).map((x) => <Link key={x} href={qs({ tag: sp.tag === x ? undefined : x })} className={chip(sp.tag === x)}>#{x}</Link>)}
              </div>
            )}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">
            {search ? `${fuzzy ? t.didYouMean : t.resultsFor} “${search}”` : sp.cat || (sp.tag ? `#${sp.tag}` : t.allProducts)}
          </h2>
          {f["F-05"] && (
            <form className="flex flex-wrap items-end gap-2 text-sm" role="search">
              {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
              {sp.tag && <input type="hidden" name="tag" value={sp.tag} />}
              <input name="q" defaultValue={search} placeholder={t.search} aria-label="Search products" className="ring-brand w-40 rounded-xl border border-slate-300 bg-white px-3 py-2" />
              <input name="min" defaultValue={sp.min} placeholder={t.min} inputMode="numeric" aria-label="Minimum price" className="ring-brand w-20 rounded-xl border border-slate-300 bg-white px-3 py-2" />
              <input name="max" defaultValue={sp.max} placeholder={t.max} inputMode="numeric" aria-label="Maximum price" className="ring-brand w-20 rounded-xl border border-slate-300 bg-white px-3 py-2" />
              <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort" className="ring-brand rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="">{t.newest}</option>
                <option value="price_asc">{t.priceLowHigh}</option>
                <option value="price_desc">{t.priceHighLow}</option>
                {f["F-04"] && <option value="rating">{t.topRated}</option>}
              </select>
              <label className="flex items-center gap-1 py-2"><input type="checkbox" name="stock" value="1" defaultChecked={sp.stock === "1"} /> {t.inStockOnly}</label>
              <button className="btn-brand !py-2">{t.filter}</button>
            </form>
          )}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-2 text-slate-600">{search || sp.cat || sp.brand || sp.tag ? t.noMatch : t.noProducts}</p>
          </div>
        ) : (
          <ul id="products" className="st-grid grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => <ProductCard cur={cur} key={String(p._id)} p={p} site={site} base={b} currency={store.currency} f={f} L={t} />)}
          </ul>
        )}

        {recent.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold">👀 {t.recentlyViewed}</h2>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {recent.slice(0, 4).map((p) => <ProductCard cur={cur} key={String(p._id)} p={p} site={site} base={b} currency={store.currency} f={f} L={t} />)}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
