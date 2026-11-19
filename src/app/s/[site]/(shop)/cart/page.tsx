import Link from "next/link";
import { requireStore, formatMoney, priceOrder } from "@/lib/tenant";
import { evaluateDiscount, viewCart } from "@/lib/cart";
import { storePrefs } from "@/lib/store-prefs";
import { fill } from "@/lib/i18n";
import { Qty } from "@/components/store/cart";
import { CodeForm } from "@/components/store/forms";
import { ProductCard } from "@/components/store/product-card";
import { upsellsFor } from "@/lib/upsells";
import { shopMoney } from "@/lib/currency";

export const metadata = { title: "Cart" };

export default async function CartPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t } = await storePrefs(store);
  const cart = await viewCart(store);
  const disc = await evaluateDiscount(store, cart.discountCode, cart.subtotal);
  const totals = priceOrder(store, cart.subtotal, disc.amount, "shipping");
  const { fm, cur } = await shopMoney(store);
  const upsells = await upsellsFor(store, cart);
  const b = store.base;
  const toFree = store.features["F-58"] && store.settings.freeShippingThreshold > 0 ? store.settings.freeShippingThreshold - (cart.subtotal - disc.amount) : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t.yourCart}</h1>
      {cart.items.length === 0 ? (
        <div className="rounded-2xl bg-white py-16 text-center shadow-sm">
          <p className="text-5xl">🛒</p>
          <p className="mt-3 text-slate-600">{t.cartEmpty}</p>
          <Link href={b || "/"} className="btn-brand mt-5">{t.startShopping}</Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white p-2 shadow-sm">
            {cart.items.map((i) => (
              <li key={i.key} className="flex gap-4 p-3">
                <div className="bg-brand-soft flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl text-3xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : "🛍️"}
                </div>
                <div className="flex-1">
                  <Link href={`${b}/p/${i.slug}`} className="font-medium hover:underline">{i.name}</Link>
                  {i.variantName && <p className="text-xs text-slate-500">{i.variantName}</p>}
                  {i.custom?.map((c) => <p key={c.label} className="text-xs text-slate-500">{c.label}: <b>{c.value}</b></p>)}
                  {i.bundle && <p className="text-xs text-slate-500">🧺 {i.bundle.map((x) => `${x.qty} × ${x.name}`).join(", ")}</p>}
                  {i.kind === "digital" && <p className="text-xs text-sky-700">💾 {t.download}</p>}
                  {i.kind === "giftcard" && <p className="text-xs text-violet-700">🎁 {t.giftCardLine}</p>}
                  <p className="text-sm text-slate-600">
                    {fm(i.price)} {t.each}
                    {i.rule && <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">{i.rule}</span>}
                    {i.listPrice > i.price && <s className="ms-2 text-xs text-slate-400">{fm(i.listPrice)}</s>}
                  </p>
                  <Qty site={site} lineKey={i.key} qty={i.qty} L={t} />
                </div>
                <p className="font-semibold">{fm(i.price * i.qty)}</p>
              </li>
            ))}
          </ul>
          <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            {store.features["F-27"] && <CodeForm site={site} current={cart.discountCode} />}
            {disc.error && cart.discountCode && <p className="text-xs text-rose-600">{disc.error}</p>}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>{t.subtotal}</dt><dd>{fm(totals.subtotal)}</dd></div>
              {totals.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>{t.discount} ({cart.discountCode})</dt><dd>−{fm(totals.discount)}</dd></div>}
              {store.features["F-29"] && <div className="flex justify-between"><dt>{t.delivery}</dt><dd>{totals.shipping ? fm(totals.shipping) : t.free}</dd></div>}
              {totals.tax > 0 && <div className="flex justify-between"><dt>{t.tax} ({store.settings.taxRate}%)</dt><dd>{fm(totals.tax)}</dd></div>}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>{t.total}</dt><dd>{fm(totals.total)}</dd></div>
            </dl>
            {toFree > 0 && <p className="bg-brand-soft rounded-xl px-3 py-2 text-xs">{fill(t.addMoreFree, { amount: fm(toFree) })}</p>}
            {cur && <p className="text-xs text-slate-500">{fill(t.pricesIn, { code: cur.code, base: store.currency })} {t.total}: {formatMoney(totals.total, store.currency)}</p>}
            <Link href={`${b}/checkout`} className="btn-brand w-full !py-3">{t.checkout}</Link>
          </aside>
        </div>
      )}
      {upsells.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">{t.boughtTogether}</h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {upsells.map((p) => <ProductCard cur={cur} key={String(p._id)} p={p} site={site} base={b} currency={store.currency} f={store.features} L={t} />)}
          </ul>
        </section>
      )}
    </main>
  );
}
