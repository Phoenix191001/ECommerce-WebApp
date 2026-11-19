import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, requireStore } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { STATUS_STEPS, canDownload, loadOrderForViewer } from "@/lib/order-view";
import { PushOptIn } from "@/components/store/push";
import { pushConfigured, pushPublicKey } from "@/lib/push";
import { storePrefs } from "@/lib/store-prefs";
import { fill, payText, statusText } from "@/lib/i18n";
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
  const { t: L, lang } = await storePrefs(store);
  const fm = (n: number) => formatMoney(n, store.currency);
  const b = store.base;
  const stepIdx = STATUS_STEPS.indexOf(o.status as (typeof STATUS_STEPS)[number]);
  const tq = t ? `?t=${encodeURIComponent(t)}` : "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {isNew && (
        <div className="bg-brand-gradient mb-6 rounded-3xl p-6 text-center text-white shadow-lg">
          <p className="text-5xl">🎉</p>
          <h1 className="mt-2 text-2xl font-bold">{fill(L.thankYou, { name: o.customer.name.split(" ")[0] })}</h1>
          <p className="mt-1 text-white/90">{fill(L.orderPlaced, { n: o.number })}{store.features["F-41"] && ` ${fill(L.confirmationOnWay, { email: o.customer.email })}`}</p>
        </div>
      )}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{fill(L.orderNo, { n: o.number })}</h2>
            <p className="text-sm text-slate-500">{fill(L.placedOn, { date: new Date(o.createdAt!).toLocaleString(lang === "ur" ? "ur-PK" : "en-GB", { timeZone: "Asia/Karachi" }) })}</p>
          </div>
          <div className="flex gap-2">
            {store.features["F-52"] && <Link href={`${b}/order/${o.number}/invoice${tq}`} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">{L.invoice}</Link>}
            {store.features["F-102"] && user?.role === "customer" && String(o.user) === String(user._id) && (
              <form action={reorder.bind(null, site, o.number)}><button className="btn-brand !py-1.5">{L.orderAgain}</button></form>
            )}
          </div>
        </div>

        {["cancelled", "refunded"].includes(o.status) ? (
          <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{fill(L.orderWas, { status: statusText(L, o.status) })}</p>
        ) : (
          <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Order progress">
            {STATUS_STEPS.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${i <= stepIdx ? "bg-brand text-white" : "bg-slate-100 text-slate-400"}`}>
                  {i < stepIdx ? "✓" : i + 1}
                </div>
                <p className={`mt-2 text-xs ${i <= stepIdx ? "font-semibold text-slate-900" : "text-slate-400"}`}>{statusText(L, s)}</p>
              </li>
            ))}
          </ol>
        )}

        <ul className="mt-8 divide-y divide-slate-100 text-sm">
          {o.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3 py-2">
              <span>
                {i.name}{i.variantName ? ` (${i.variantName})` : ""} × {i.qty}
                {i.custom?.map((c) => <span key={c.label} className="block text-xs text-slate-500">{c.label}: {c.value}</span>)}
                {i.bundle?.length ? <span className="block text-xs text-slate-500">🧺 {i.bundle.map((x) => `${x.qty} × ${x.name}`).join(", ")}</span> : null}
              </span>
              <span>{fm(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between"><dt>{L.subtotal}</dt><dd>{fm(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>{L.discount} {o.discountCode && `(${o.discountCode})`}</dt><dd>−{fm(o.discount)}</dd></div>}
          <div className="flex justify-between"><dt>{L.delivery}</dt><dd>{o.shipping ? fm(o.shipping) : L.free}</dd></div>
          {o.tax > 0 && <div className="flex justify-between"><dt>{L.tax}</dt><dd>{fm(o.tax)}</dd></div>}
          {o.giftWrapFee > 0 && <div className="flex justify-between"><dt>🎁 {L.giftWrapLine}</dt><dd>{fm(o.giftWrapFee)}</dd></div>}
          {o.pointsDiscount > 0 && <div className="flex justify-between text-emerald-700"><dt>⭐ {L.points} ({o.pointsRedeemed})</dt><dd>−{fm(o.pointsDiscount)}</dd></div>}
          {o.creditUsed > 0 && <div className="flex justify-between text-emerald-700"><dt>💳 {L.storeCredit}</dt><dd>−{fm(o.creditUsed)}</dd></div>}
          {o.giftCardUsed > 0 && <div className="flex justify-between text-emerald-700"><dt>🎁 {L.giftCardLine}</dt><dd>−{fm(o.giftCardUsed)}</dd></div>}
          <div className="flex justify-between text-base font-bold"><dt>{L.total}</dt><dd className="text-brand">{fm(o.total)}</dd></div>
        </dl>
        {store.features["F-12"] && o.items.some((i) => i.kind === "digital") && (
          <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
            <p className="mb-2 font-semibold text-sky-900">{L.downloads}</p>
            {canDownload(o) ? (
              <ul className="space-y-2">
                {o.items.map((i, idx) => i.kind === "digital" && (
                  <li key={idx}><a href={`${b}/download/${o.number}/${idx}${tq}`} className="btn-brand !py-1.5">⬇️ {L.download}: {i.name}</a></li>
                ))}
              </ul>
            ) : <p className="text-sky-900">{L.downloadAfterConfirm}</p>}
          </div>
        )}
        {store.features["F-32"] && o.items.some((i) => i.kind === "giftcard") && (
          <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm">
            <p className="mb-2 font-semibold text-violet-900">{L.giftCardsBought}</p>
            {o.giftCardsIssued.length ? (
              <ul className="space-y-1 font-mono text-lg tracking-wider text-violet-900">{o.giftCardsIssued.map((c) => <li key={c}>{c}</li>)}</ul>
            ) : <p className="text-violet-900">{L.giftCardsPending}</p>}
          </div>
        )}
        {store.features["F-99"] && o.shipments?.length > 0 && (
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="mb-2 font-semibold">{L.shipments}</p>
            <ol className="space-y-2">
              {o.shipments.map((sh, n) => (
                <li key={n}>
                  <b>{fill(L.shipmentN, { n: n + 1 })}</b> · {new Date(sh.at).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", { timeZone: "Asia/Karachi" })}
                  {sh.courier && <> · {sh.courier}</>}{sh.tracking && <> · {L.tracking}: <span className="font-mono">{sh.tracking}</span></>}
                  <span className="block text-slate-600">{sh.items.map((x) => `${o.items[x.line]?.name ?? "?"} × ${x.qty}`).join(", ")}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {store.features["F-109"] && pushConfigured() && !["delivered", "cancelled", "refunded"].includes(o.status) && (
          <div className="mt-6"><PushOptIn site={site} publicKey={pushPublicKey()} order={o.number} token={t} L={L} /></div>
        )}
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">{o.delivery === "pickup" ? L.pickupLabel : L.delivery}</p>
            {o.delivery === "none" && <p className="text-slate-600">{L.noDeliveryNeeded}</p>}
            <p className="text-slate-600">{o.customer.name} · {o.customer.phone}</p>
            {o.delivery === "pickup" ? <p className="text-slate-600">{store.settings.pickupAddress || L.collectFromShop}</p> : o.delivery === "shipping" ? <p className="text-slate-600">{o.customer.address}, {o.customer.city}</p> : null}
            {o.deliverySlot && <p className="text-slate-600">🕒 {o.deliverySlot}</p>}
            {o.giftWrap && <p className="text-slate-600">{L.giftWrapped}{o.giftMessage ? `: “${o.giftMessage}”` : ""}</p>}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold">{L.paymentLabel}</p>
            <p className="text-slate-600">{o.paymentMethod === "cod" ? L.cashOnDelivery : o.paymentMethod === "cash" ? L.cash : o.paymentMethod} · {payText(L, o.paymentStatus)}</p>
          </div>
        </div>
        {store.features["F-46"] && o.status === "delivered" && user?.role === "customer" && String(o.user) === String(user._id) && (
          <p className="mt-6 text-sm"><Link href={`${b}/account/returns?order=${o.number}`} className="text-brand font-semibold underline">{L.returnItems}</Link></p>
        )}
        {o.pointsEarned > 0 && <p className="mt-4 text-sm text-emerald-700">{fill(L.earnedPoints, { n: o.pointsEarned })}</p>}
        {isNew && t && (
          <p className="mt-6 text-xs text-slate-500">{fill(L.bookmark, { n: o.number })}</p>
        )}
      </div>
    </main>
  );
}
