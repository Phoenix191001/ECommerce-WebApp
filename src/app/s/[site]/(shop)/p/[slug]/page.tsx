import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStore, storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { AddToCart } from "@/components/store/cart";
import { ReviewForm } from "@/components/store/forms";
import { toggleWishlist } from "../../../shop-actions";

type Props = { params: Promise<{ site: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, slug } = await params;
  const store = await getStore(site);
  if (!store) return {};
  const p = await (await storeModels(store)).Product.findOne({ slug, status: "active" }).lean();
  return p ? { title: p.name, description: p.description.slice(0, 160) } : {};
}

export default async function ProductPage({ params }: Props) {
  const { site, slug } = await params;
  const store = await requireStore(site);
  const f = store.features;
  if (!f["F-01"]) notFound();
  const m = await storeModels(store);
  const p = await m.Product.findOne({ slug, status: "active" }).lean();
  if (!p) notFound();
  const [user, reviews] = await Promise.all([
    getCurrentUser(store),
    f["F-04"] ? m.Review.find({ product: p._id }).sort({ createdAt: -1 }).limit(30).lean() : Promise.resolve([]),
  ]);
  const customer = user?.role === "customer" ? user : null;
  const wished = !!customer?.wishlist?.some((w) => String(w) === String(p._id));
  const out = f["F-17"] && p.stock <= 0;
  const images = f["F-03"] ? p.images : p.images.slice(0, 1);
  const b = store.base;
  const low = f["F-17"] && p.stock > 0 && p.stock <= store.settings.lowStockAt;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href={b || "/"} className="hover:underline">Home</Link>
        {p.category && f["F-06"] && <> / <Link href={`${b || "/"}?cat=${encodeURIComponent(p.category)}`} className="hover:underline">{p.category}</Link></>}
        {" / "}<span className="text-slate-700">{p.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="bg-brand-soft aspect-square overflow-hidden rounded-3xl">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-8xl" aria-hidden>🛍️</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.slice(1, 9).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={src} href={src} target="_blank"><img src={src} alt="" className="aspect-square rounded-xl object-cover" /></a>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-5">
          {p.brand && <p className="text-sm font-semibold uppercase tracking-wide text-brand">{p.brand}</p>}
          <h1 className="text-3xl font-bold">{p.name}</h1>
          {f["F-04"] && p.ratingCount > 0 && (
            <p className="text-amber-500">{"★".repeat(Math.round(p.ratingAvg))}{"☆".repeat(5 - Math.round(p.ratingAvg))} <span className="text-sm text-slate-500">{p.ratingAvg.toFixed(1)} · {p.ratingCount} reviews</span></p>
          )}
          <p className="text-3xl font-bold text-brand">
            {formatMoney(p.price, store.currency)}
            {p.compareAtPrice && p.compareAtPrice > p.price && <s className="ml-3 text-lg font-normal text-slate-400">{formatMoney(p.compareAtPrice, store.currency)}</s>}
          </p>
          {f["F-17"] && (
            <p className={`text-sm font-medium ${out ? "text-rose-600" : low ? "text-amber-600" : "text-emerald-600"}`}>
              {out ? "Out of stock" : low ? `Only ${p.stock} left — order soon` : "In stock"}
            </p>
          )}
          <AddToCart site={site} product={String(p._id)} disabled={out} full />
          {f["F-10"] && (
            <form action={toggleWishlist.bind(null, site, String(p._id))}>
              <button className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-medium hover:bg-slate-50">
                {wished ? "💖 Saved to wishlist" : "🤍 Save to wishlist"}
              </button>
            </form>
          )}
          {p.description && <div className="whitespace-pre-line rounded-2xl bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm">{p.description}</div>}
          {f["F-58"] && store.settings.freeShippingThreshold > 0 && (
            <p className="bg-brand-soft rounded-xl px-3 py-2 text-sm">🚚 Free delivery on orders over {formatMoney(store.settings.freeShippingThreshold, store.currency)}</p>
          )}
        </div>
      </div>

      {f["F-04"] && (
        <section className="mt-12 grid gap-8 md:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="mb-4 text-xl font-bold">Reviews</h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet. Be the first!</p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={String(r._id)} className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-amber-500">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></p>
                    <p className="mt-1 text-sm text-slate-700">{r.text}</p>
                    <p className="mt-2 text-xs text-slate-500">{r.name} · {new Date(r.createdAt!).toLocaleDateString("en-GB")}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">Write a review</h3>
            {customer ? <ReviewForm site={site} product={String(p._id)} /> : (
              <p className="text-sm text-slate-600"><Link href={`${b}/account/login`} className="text-brand font-medium underline">Sign in</Link> to write a review.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
