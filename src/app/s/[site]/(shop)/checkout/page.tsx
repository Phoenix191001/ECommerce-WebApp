import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney, priceOrder, requireStore } from "@/lib/tenant";
import { evaluateDiscount, viewCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/store-auth";
import { CheckoutForm } from "@/components/store/forms";
import { ExitIntent } from "@/components/store/extras";
import { storePrefs } from "@/lib/store-prefs";

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
        <h1 className="text-2xl font-bold">Sign in to check out</h1>
        <p className="mt-2 text-slate-600">This store asks customers to have an account.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`${b}/account/login`} className="btn-brand">Sign in</Link>
          <Link href={`${b}/account/register`} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold">Create account</Link>
        </div>
      </main>
    );
  }

  const disc = await evaluateDiscount(store, cart.discountCode, cart.subtotal);
  const totals = priceOrder(store, cart.subtotal, disc.amount, "shipping");
  const fm = (n: number) => formatMoney(n, store.currency);
  const addr = customer?.addresses?.[0];
  const methods = [
    { id: "cod" as const, label: "💵 Cash on delivery", note: "Pay in cash when your order arrives.", available: !!f["F-23"], show: !!f["F-23"] },
    { id: "card" as const, label: "💳 Debit or credit card", note: "Online card payment is being set up for this store.", available: false, show: !!f["F-24"] },
    { id: "wallet" as const, label: "📱 JazzCash or Easypaisa", note: "Wallet payment is being set up for this store.", available: false, show: !!f["F-25"] },
  ].filter((m) => m.show);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {f["F-119"] && f["F-27"] && /^[A-Z0-9_-]{3,30}$/.test(store.settings.exitOfferCode) && <ExitIntent code={store.settings.exitOfferCode} L={t} />}
      <h1 className="mb-6 text-3xl font-bold">{t.checkout}</h1>
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {!customer && f["F-22"] && (
            <p className="mb-5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Have an account? <Link href={`${b}/account/login`} className="text-brand font-semibold underline">Sign in</Link> for faster checkout. Or continue as a guest.
            </p>
          )}
          {methods.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This store hasn't turned on any payment method yet. Please contact the store.</p>
          ) : (
            <CheckoutForm
              site={site}
              defaults={{ name: customer?.name ?? "", email: customer?.email ?? "", phone: addr?.phone || customer?.phone || "", address: addr?.address ?? "", city: addr?.city ?? "" }}
              pickup={!!f["F-59"]}
              pickupAddress={store.settings.pickupAddress}
              methods={methods}
              totalLabel={fm(totals.total)}
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
          <h2 className="mb-3 font-semibold">Order summary</h2>
          <ul className="space-y-2 text-sm">
            {cart.items.map((i) => (
              <li key={i.product} className="flex justify-between gap-2"><span>{i.name} × {i.qty}</span><span>{fm(i.price * i.qty)}</span></li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{fm(totals.subtotal)}</dd></div>
            {totals.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>−{fm(totals.discount)}</dd></div>}
            {f["F-29"] && <div className="flex justify-between"><dt>Delivery</dt><dd>{totals.shipping ? fm(totals.shipping) : "Free"}</dd></div>}
            {totals.tax > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{fm(totals.tax)}</dd></div>}
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="text-brand">{fm(totals.total)}</dd></div>
          </dl>
          {f["F-59"] && <p className="mt-2 text-xs text-slate-500">Choosing pickup removes the delivery fee.</p>}
        </aside>
      </div>
    </main>
  );
}
