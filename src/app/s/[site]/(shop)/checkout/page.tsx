import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney, priceOrder, requireStore } from "@/lib/tenant";
import { evaluateDiscount, viewCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/store-auth";
import { CheckoutForm } from "@/components/store/forms";
import { ExitIntent } from "@/components/store/extras";
import { storePrefs } from "@/lib/store-prefs";
import { shopMoney } from "@/lib/currency";
import { upsellsFor } from "@/lib/upsells";
import { fill } from "@/lib/i18n";
import { AddToCart } from "@/components/store/cart";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const f = store.features;
  const b = store.base;
  const cart = await viewCart(store);
  if (!cart.items.length) redirect(`${b}/cart`);
  const user = await getCurrentUser(store);
  const customer = user?.role === "customer" ? user : null;
  const { t } = await storePrefs(store);

  if (!customer && !f["F-19"]) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{t.signInToCheckout}</h1>
        <p className="mt-2 text-slate-600">{t.needAccount}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`${b}/account/login`} className="btn-brand">{t.signIn}</Link>
          <Link href={`${b}/account/register`} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold">{t.createAccount}</Link>
        </div>
      </main>
    );
  }

  const disc = await evaluateDiscount(store, cart.discountCode, cart.subtotal);
  const totals = priceOrder(store, cart.subtotal, disc.amount, cart.needsShipping ? "shipping" : "none");
  const { fm: show, cur } = await shopMoney(store);
  const fm = (n: number) => formatMoney(n, store.currency);
  const upsells = await upsellsFor(store, cart, 3);
  const addr = customer?.addresses?.[0];
  const methods = [
    { id: "cod" as const, label: t.cod, note: t.codNote, available: !!f["F-23"], show: !!f["F-23"] },
    { id: "card" as const, label: t.card, note: t.cardNote, available: false, show: !!f["F-24"] },
    { id: "wallet" as const, label: t.wallet, note: t.walletNote, available: false, show: !!f["F-25"] },
  ].filter((m) => m.show);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {f["F-119"] && f["F-27"] && /^[A-Z0-9_-]{3,30}$/.test(store.settings.exitOfferCode) && <ExitIntent code={store.settings.exitOfferCode} L={t} />}
      <h1 className="mb-6 text-3xl font-bold">{t.checkout}</h1>
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {!customer && f["F-22"] && (
            <p className="mb-5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {t.haveAccount} <Link href={`${b}/account/login`} className="text-brand font-semibold underline">{t.signIn}</Link> {t.fasterCheckout}
            </p>
          )}
          {methods.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t.noPayment}</p>
          ) : (
            <CheckoutForm
              site={site}
              t={t}
              needsShipping={cart.needsShipping}
              giftCards={!!f["F-32"]}
              defaults={{ name: customer?.name ?? "", email: customer?.email ?? "", phone: addr?.phone || customer?.phone || "", address: addr?.address ?? "", city: addr?.city ?? "" }}
              pickup={!!f["F-59"]}
              pickupAddress={store.settings.pickupAddress}
              methods={methods}
              totalLabel={cur ? `${fm(totals.total)} (≈ ${show(totals.total)})` : fm(totals.total)}
              addresses={f["F-107"] ? (customer?.addresses ?? []).map((a) => ({ label: a.label, address: a.address, city: a.city, phone: a.phone })) : []}
              canSaveAddress={!!(customer && f["F-107"])}
              slots={f["F-60"] && f["F-29"] ? store.settings.deliverySlots : []}
              giftWrapFee={f["F-74"] ? fm(store.settings.giftWrapFee) : null}
              points={customer && f["F-28"] && customer.loyaltyPoints > 0 ? { balance: customer.loyaltyPoints, worth: fm(Math.floor(customer.loyaltyPoints * store.settings.pointValue)) } : null}
              credit={customer && f["F-56"] && customer.storeCredit > 0 ? { balance: fm(customer.storeCredit) } : null}
            />
          )}
        </div>
        <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">{t.orderSummary}</h2>
          <ul className="space-y-2 text-sm">
            {cart.items.map((i) => (
              <li key={i.key} className="flex justify-between gap-2"><span>{i.name}{i.variantName ? ` (${i.variantName})` : ""} × {i.qty}{i.custom?.length ? <span className="block text-xs text-slate-500">{i.custom.map((c) => `${c.label}: ${c.value}`).join(" · ")}</span> : null}</span><span>{fm(i.price * i.qty)}</span></li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between"><dt>{t.subtotal}</dt><dd>{fm(totals.subtotal)}</dd></div>
            {totals.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>{t.discount}</dt><dd>−{fm(totals.discount)}</dd></div>}
            {f["F-29"] && cart.needsShipping && <div className="flex justify-between"><dt>{t.delivery}</dt><dd>{totals.shipping ? fm(totals.shipping) : t.free}</dd></div>}
            {totals.tax > 0 && <div className="flex justify-between"><dt>{t.tax}</dt><dd>{fm(totals.tax)}</dd></div>}
            <div className="flex justify-between text-base font-bold"><dt>{t.total}</dt><dd className="text-brand">{fm(totals.total)}</dd></div>
          </dl>
          {f["F-59"] && cart.needsShipping && <p className="mt-2 text-xs text-slate-500">{t.pickupNoFee}</p>}
          {cur && <p className="mt-2 text-xs text-slate-500">{fill(t.pricesIn, { code: cur.code, base: store.currency })}</p>}
          {upsells.length > 0 && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="mb-2 text-sm font-semibold">{t.boughtTogether}</p>
              <ul className="space-y-3">
                {upsells.map((p) => (
                  <li key={String(p._id)} className="flex items-center gap-3 text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="bg-brand-soft flex h-12 w-12 items-center justify-center rounded-lg">🛍️</span>}
                    <span className="flex-1">{p.name}<span className="block text-xs text-slate-500">{fm(p.price)}</span></span>
                    {!p.variants?.length && !p.customFields?.length ? <div className="w-24"><AddToCart site={site} product={String(p._id)} L={t} /></div> : <a href={`${b}/p/${p.slug}`} className="text-brand text-xs font-semibold underline">{t.chooseOption}</a>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
