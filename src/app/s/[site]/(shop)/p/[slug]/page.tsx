import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStore, requireStore, storeModels, formatMoney } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { storePrefs } from "@/lib/store-prefs";
import { fill } from "@/lib/i18n";
import { basePrice, hasVariants, isPublished, saleActive, visibleFilter } from "@/lib/pricing";
import { ReviewForm } from "@/components/store/forms";
import { BuyBox, Countdown, QuestionForm, RecordView } from "@/components/store/extras";
import { ProductCard } from "@/components/store/product-card";
import { toggleCompare, toggleWishlist } from "../../../shop-actions";
import { loadParts, sellableStock } from "@/lib/cart";
import { displayCurrency } from "@/lib/currency";

type Props = { params: Promise<{ site: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, slug } = await params;
  const store = await getStore(site);
  if (!store) return {};
  const p = await (await storeModels(store)).Product.findOne({ slug, status: "active" }).lean();
  return p ? { title: p.name, description: p.description.slice(0, 160), openGraph: { images: p.images?.slice(0, 1) } } : {};
}

export default async function ProductPage({ params }: Props) {
  const { site, slug } = await params;
  const store = await requireStore(site);
  const f = store.features;
  if (!f["F-01"]) notFound();
  const m = await storeModels(store);
  const p = await m.Product.findOne({ slug, status: "active" }).lean();
  if (!p || !isPublished(p, f)) notFound();
  const { t } = await storePrefs(store);
  const [user, reviews, questions, related, jar] = await Promise.all([
    getCurrentUser(store),
    f["F-04"] ? m.Review.find({ product: p._id }).sort({ createdAt: -1 }).limit(30).lean() : Promise.resolve([]),
    f["F-65"] ? m.Question.find({ product: p._id, published: true }).sort({ createdAt: -1 }).limit(30).lean() : Promise.resolve([]),
    f["F-08"] && (p.category || p.tags?.length)
      ? m.Product.find({ $and: [visibleFilter(f), { _id: { $ne: p._id } }, { $or: [...(p.category ? [{ category: p.category }] : []), ...(p.tags?.length ? [{ tags: { $in: p.tags } }] : [])] }] }).limit(4).lean()
      : Promise.resolve([]),
    cookies(),
  ]);
  const customer = user?.role === "customer" ? user : null;
  const wished = !!customer?.wishlist?.some((w) => String(w) === String(p._id));
  const comparing = (jar.get(`cmp_${store.id}`)?.value ?? "").split(",").includes(String(p._id));
  const images = f["F-03"] ? p.images : p.images.slice(0, 1);
  const b = store.base;
  const ctx = { features: f, wholesale: !!customer?.wholesale };
  const variants = f["F-02"] && hasVariants(p)
    ? p.variants.map((v) => ({ id: String(v._id), name: v.name, price: basePrice(p, String(v._id), ctx), stock: v.stock }))
    : [];
  const price = basePrice(p, null, ctx);
  const onSale = saleActive(p, ctx);
  const was = onSale ? p.price : p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : null;
  const tiers = f["F-62"] ? (p.volumeTiers ?? []).filter((x) => x.price < price) : [];
  const isBundle = !!(f["F-13"] && p.bundle?.length);
  const parts = isBundle ? await loadParts(store, [p]) : new Map();
  const stock = sellableStock(p, undefined, parts, f);
  const kind = (f["F-12"] && p.kind === "digital") || (f["F-32"] && p.kind === "giftcard") ? p.kind : "physical";
  const customFields = (f["F-63"] || kind === "giftcard") ? (p.customFields ?? []).map((c) => ({ label: c.label, required: c.required, maxLength: c.maxLength })) : [];
  const [cur, seller] = await Promise.all([
    displayCurrency(store),
    f["F-67"] && p.seller ? m.Seller.findOne({ _id: p.seller, status: "active" }, { name: 1, slug: 1 }).lean() : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {f["F-09"] && <RecordView storeId={store.id} product={String(p._id)} />}
      <nav className="mb-4 text-sm text-slate-500">
        <Link href={b || "/"} className="hover:underline">{t.home}</Link>
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
          {p.brand && (f["F-07"]
            ? <Link href={`${b}/brand/${encodeURIComponent(p.brand)}`} className="text-sm font-semibold uppercase tracking-wide text-brand hover:underline">{p.brand}</Link>
            : <p className="text-sm font-semibold uppercase tracking-wide text-brand">{p.brand}</p>)}
          <h1 className="text-3xl font-bold">{p.name}</h1>
          {f["F-04"] && p.ratingCount > 0 && (
            <p className="text-amber-500">{"★".repeat(Math.round(p.ratingAvg))}{"☆".repeat(5 - Math.round(p.ratingAvg))} <span className="text-sm text-slate-500">{p.ratingAvg.toFixed(1)} · {p.ratingCount}</span></p>
          )}
          {onSale && p.saleEndsAt && <Countdown until={new Date(p.saleEndsAt).toISOString()} label={t.saleEndsIn} />}
          {was && !variants.length && <p className="text-sm text-slate-400"><s>{formatMoney(was, store.currency)}</s> <span className="ms-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">−{Math.round(((was - price) / was) * 100)}%</span></p>}
          <BuyBox
            site={site}
            product={String(p._id)}
            variants={variants}
            optionLabel={(p.optionNames ?? []).join(" / ")}
            basePrice={price}
            baseStock={stock}
            customFields={customFields}
            fmt={cur}
            trackStock={!!f["F-17"]}
            lowAt={store.settings.lowStockAt}
            currency={store.currency}
            alerts={!!f["F-14"]}
            L={t}
          />
          {tiers.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="mb-1 font-semibold text-emerald-800">📦 {t.buyMore}</p>
              <ul className="space-y-0.5 text-emerald-900">
                {tiers.map((x) => <li key={x.minQty}>{x.minQty} {t.orMore}: <b>{formatMoney(x.price, store.currency)}</b> {t.each}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {f["F-10"] && (
              <form action={toggleWishlist.bind(null, site, String(p._id))} className="flex-1">
                <button className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-medium hover:bg-slate-50">{wished ? t.savedWishlist : t.saveWishlist}</button>
              </form>
            )}
            {f["F-11"] && (
              <form action={toggleCompare.bind(null, site, String(p._id))}>
                <button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50">{comparing ? t.comparing : `⚖️ ${t.compare}`}</button>
              </form>
            )}
          </div>
          {kind === "digital" && <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{t.instantDownload}</p>}
          {kind === "giftcard" && <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">{t.giftCardBadge}</p>}
          {isBundle && (
            <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
              <p className="mb-1 font-semibold">{t.inThisBundle}</p>
              <ul className="list-inside list-disc text-slate-700">{p.bundle.map((x) => <li key={String(x.product)}>{x.qty} × {x.name}</li>)}</ul>
            </div>
          )}
          {seller && <p className="text-sm text-slate-600">{t.soldBy} <Link href={`${b}/seller/${seller.slug}`} className="text-brand font-semibold hover:underline">{seller.name}</Link></p>}
          {f["F-111"] && p.warrantyMonths > 0 && <p className="text-sm">🛡️ {fill(t.warranty, { n: p.warrantyMonths })}</p>}
          {p.description && <div className="whitespace-pre-line rounded-2xl bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm">{p.description}</div>}
          {f["F-64"] && p.sizeGuide && (
            <details className="rounded-2xl bg-white p-4 text-sm shadow-sm">
              <summary className="cursor-pointer font-semibold">📏 {t.sizeGuide}</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-slate-700">{p.sizeGuide}</pre>
            </details>
          )}
          {f["F-58"] && store.settings.freeShippingThreshold > 0 && (
            <p className="bg-brand-soft rounded-xl px-3 py-2 text-sm">🚚 {t.freeDeliveryOver} {formatMoney(store.settings.freeShippingThreshold, store.currency)}</p>
          )}
          {f["F-93"] && p.tags?.length > 0 && (
            <p className="flex flex-wrap gap-1.5 text-xs">{p.tags.map((x) => <Link key={x} href={`${b || "/"}?tag=${encodeURIComponent(x)}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 hover:bg-slate-200">#{x}</Link>)}</p>
          )}
        </div>
      </div>

      {(f["F-04"] || f["F-65"]) && (
        <section className="mt-12 grid gap-8 md:grid-cols-2">
          {f["F-04"] && (
            <div>
              <h2 className="mb-4 text-xl font-bold">{t.reviews}</h2>
              {reviews.length === 0 ? <p className="text-sm text-slate-500">{t.noReviews}</p> : (
                <ul className="space-y-3">
                  {reviews.map((r) => (
                    <li key={String(r._id)} className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-amber-500">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></p>
                      <p className="mt-1 text-sm text-slate-700">{r.text}</p>
                      <p className="mt-2 text-xs text-slate-500">{r.name} · {new Date(r.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-semibold">{t.writeReview}</h3>
                {customer ? <ReviewForm site={site} product={String(p._id)} /> : (
                  <p className="text-sm text-slate-600"><Link href={`${b}/account/login`} className="text-brand font-medium underline">{t.signIn}</Link> {t.signInToReview}</p>
                )}
              </div>
            </div>
          )}
          {f["F-65"] && (
            <div>
              <h2 className="mb-4 text-xl font-bold">❓ {t.questions}</h2>
              {questions.length === 0 ? <p className="text-sm text-slate-500">{t.noQuestions}</p> : (
                <ul className="space-y-3">
                  {questions.map((q) => (
                    <li key={String(q._id)} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                      <p className="font-medium">Q: {q.question}</p>
                      <p className="mt-1 text-slate-700">A: {q.answer}</p>
                      <p className="mt-1 text-xs text-slate-500">{q.name}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="mb-3 font-semibold">{t.askQuestion}</h3>
                <QuestionForm site={site} product={String(p._id)} L={t} />
              </div>
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">✨ {t.related}</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((r) => <ProductCard cur={cur} key={String(r._id)} p={r} site={site} base={b} currency={store.currency} f={f} L={t} />)}
          </ul>
        </section>
      )}
    </main>
  );
}

