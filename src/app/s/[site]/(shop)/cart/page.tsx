import Link from "next/link";
import { getStore, formatMoney, priceOrder } from "@/lib/tenant";
import { evaluateDiscount, viewCart } from "@/lib/cart";
import { Qty } from "@/components/store/cart";
import { CodeForm } from "@/components/store/forms";

export const metadata = { title: "Cart" };

export default async function CartPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = (await getStore(site))!;
  const cart = await viewCart(store);
  const disc = await evaluateDiscount(store, cart.discountCode, cart.subtotal);
  const totals = priceOrder(store, cart.subtotal, disc.amount, "shipping");
  const fm = (n: number) => formatMoney(n, store.currency);
  const b = store.base;
  const toFree = store.features["F-58"] && store.settings.freeShippingThreshold > 0 ? store.settings.freeShippingThreshold - (cart.subtotal - disc.amount) : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Your cart</h1>
      {cart.items.length === 0 ? (
        <div className="rounded-2xl bg-white py-16 text-center shadow-sm">
          <p className="text-5xl">🛒</p>
          <p className="mt-3 text-slate-600">Your cart is empty.</p>
          <Link href={b || "/"} className="btn-brand mt-5">Start shopping</Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white p-2 shadow-sm">
            {cart.items.map((i) => (
              <li key={i.product} className="flex gap-4 p-3">
                <div className="bg-brand-soft flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl text-3xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : "🛍️"}
                </div>
                <div className="flex-1">
                  <Link href={`${b}/p/${i.slug}`} className="font-medium hover:underline">{i.name}</Link>
                  <p className="text-sm text-slate-600">{fm(i.price)} each</p>
                  <Qty site={site} product={i.product} qty={i.qty} />
                </div>
                <p className="font-semibold">{fm(i.price * i.qty)}</p>
              </li>
            ))}
          </ul>
          <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            {store.features["F-27"] && <CodeForm site={site} current={cart.discountCode} />}
            {disc.error && cart.discountCode && <p className="text-xs text-rose-600">{disc.error}</p>}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{fm(totals.subtotal)}</dd></div>
              {totals.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount ({cart.discountCode})</dt><dd>−{fm(totals.discount)}</dd></div>}
              {store.features["F-29"] && <div className="flex justify-between"><dt>Delivery</dt><dd>{totals.shipping ? fm(totals.shipping) : "Free"}</dd></div>}
              {totals.tax > 0 && <div className="flex justify-between"><dt>Tax ({store.settings.taxRate}%)</dt><dd>{fm(totals.tax)}</dd></div>}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{fm(totals.total)}</dd></div>
            </dl>
            {toFree > 0 && <p className="bg-brand-soft rounded-xl px-3 py-2 text-xs">Add {fm(toFree)} more for free delivery 🚚</p>}
            <Link href={`${b}/checkout`} className="btn-brand w-full !py-3">Checkout</Link>
          </aside>
        </div>
      )}
    </main>
  );
}
