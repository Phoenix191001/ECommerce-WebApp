import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, requireStore } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { STATUS_LABEL, STATUS_STEPS, loadOrderForViewer } from "@/lib/order-view";
import { reorder } from "../../../shop-actions";

export const metadata = { title: "Your order" };

type Props = { params: Promise<{ site: string; number: string }>; searchParams: Promise<{ t?: string; new?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { site, number } = await params;
  const { t, new: isNew } = await searchParams;
  const store = await requireStore(site);
  const o = await loadOrderForViewer(store, Number(number), t);
  if (!o) notFound();
  const user = await getCurrentUser(store);
  const fm = (n: number) => formatMoney(n, store.currency);
  const b = store.base;
  const stepIdx = STATUS_STEPS.indexOf(o.status as (typeof STATUS_STEPS)[number]);
  const tq = t ? `?t=${encodeURIComponent(t)}` : "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {isNew && (
        <div className="bg-brand-gradient mb-6 rounded-3xl p-6 text-center text-white shadow-lg">
          <p className="text-5xl">🎉</p>
          <h1 className="mt-2 text-2xl font-bold">Thank you, {o.customer.name.split(" ")[0]}!</h1>
          <p className="mt-1 text-white/90">Your order #{o.number} is placed.{store.features["F-41"] && ` A confirmation is on its way to ${o.customer.email}.`}</p>
        </div>
      )}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Order #{o.number}</h2>
            <p className="text-sm text-slate-500">Placed {new Date(o.createdAt!).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</p>
          </div>
          <div className="flex gap-2">
            {store.features["F-52"] && <Link href={`${b}/order/${o.number}/invoice${tq}`} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">🧾 Invoice</Link>}
            {store.features["F-102"] && user?.role === "customer" && String(o.user) === String(user._id) && (
              <form action={reorder.bind(null, site, o.number)}><button className="btn-brand !py-1.5">🔁 Order again</button></form>
            )}
          </div>
        </div>

        {["cancelled", "refunded"].includes(o.status) ? (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">This order was {o.status}.</p>
        ) : (
          <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Order progress">
            {STATUS_STEPS.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${i <= stepIdx ? "bg-brand text-white" : "bg-slate-100 text-slate-400"}`}>
                  {i < stepIdx ? "✓" : i + 1}
                </div>
                <p className={`mt-2 text-xs ${i <= stepIdx ? "font-semibold text-slate-900" : "text-slate-400"}`}>{STATUS_LABEL[s]}</p>
              </li>
            ))}
          </ol>
        )}

        <ul className="mt-8 divide-y divide-slate-100 text-sm">
          {o.items.map((i) => (
            <li key={`${i.product}:${i.variant ?? ""}`} className="flex justify-between py-2"><span>{i.name}{i.variantName ? ` (${i.variantName})` : ""} × {i.qty}</span><span>{fm(i.price * i.qty)}</span></li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{fm(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount {o.discountCode && `(${o.discountCode})`}</dt><dd>−{fm(o.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{o.shipping ? fm(o.shipping) : "Free"}</dd></div>
          {o.tax > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{fm(o.tax)}</dd></div>}
          {o.giftWrapFee > 0 && <div className="flex justify-between"><dt>🎁 Gift wrap</dt><dd>{fm(o.giftWrapFee)}</dd></div>}
          {o.pointsDiscount > 0 && <div className="flex justify-between text-emerald-700"><dt>⭐ Points ({o.pointsRedeemed})</dt><dd>−{fm(o.pointsDiscount)}</dd></div>}
          {o.creditUsed > 0 && <div className="flex justify-between text-emerald-700"><dt>💳 Store credit</dt><dd>−{fm(o.creditUsed)}</dd></div>}
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="text-brand">{fm(o.total)}</dd></div>
        </dl>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">{o.delivery === "pickup" ? "Pickup" : "Delivery"}</p>
            <p className="text-slate-600">{o.customer.name} · {o.customer.phone}</p>
            {o.delivery === "pickup" ? <p className="text-slate-600">{store.settings.pickupAddress || "Collect from the shop"}</p> : <p className="text-slate-600">{o.customer.address}, {o.customer.city}</p>}
            {o.deliverySlot && <p className="text-slate-600">🕒 {o.deliverySlot}</p>}
            {o.giftWrap && <p className="text-slate-600">🎁 Gift wrapped{o.giftMessage ? `: “${o.giftMessage}”` : ""}</p>}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">Payment</p>
            <p className="text-slate-600">{o.paymentMethod === "cod" ? "Cash on delivery" : o.paymentMethod === "cash" ? "Cash" : o.paymentMethod} · {o.paymentStatus.replace("_", " ")}</p>
          </div>
        </div>
        {store.features["F-46"] && o.status === "delivered" && user?.role === "customer" && String(o.user) === String(user._id) && (
          <p className="mt-6 text-sm"><Link href={`${b}/account/returns?order=${o.number}`} className="text-brand font-semibold underline">↩️ Return or exchange items</Link></p>
        )}
        {o.pointsEarned > 0 && <p className="mt-4 text-sm text-emerald-700">⭐ You earned {o.pointsEarned} loyalty points with this order.</p>}
        {isNew && t && (
          <p className="mt-6 text-xs text-slate-500">Bookmark this page to check your order later. You can also use “Track order” with #{o.number} and your email.</p>
        )}
      </div>
    </main>
  );
}
