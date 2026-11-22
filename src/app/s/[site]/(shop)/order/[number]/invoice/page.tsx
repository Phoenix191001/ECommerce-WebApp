import { notFound } from "next/navigation";
import { formatMoney, requireStore } from "@/lib/tenant";
import { loadOrderForViewer } from "@/lib/order-view";
import { PrintButton } from "@/components/store/print";
import { storePrefs } from "@/lib/store-prefs";
import { DOCS } from "@/lib/doc-i18n";
import { dateLocale } from "@/lib/languages";

export const metadata = { title: "Invoice" };

// F-52: printable invoice. "Save as PDF" from the print dialog gives the PDF.
export default async function InvoicePage({ params, searchParams }: { params: Promise<{ site: string; number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { site, number } = await params;
  const { t } = await searchParams;
  const store = await requireStore(site);
  if (!store.features["F-52"]) notFound();
  const o = await loadOrderForViewer(store, Number(number), t);
  if (!o) notFound();
  const fm = (n: number) => formatMoney(n, store.currency);
  const { lang } = await storePrefs(store);
  const d = DOCS[lang];
  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-10 print:px-0">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-brand text-2xl font-bold">{store.name}</h1>
          {store.settings.contactEmail && <p className="text-sm text-slate-500">{store.settings.contactEmail}</p>}
          {store.features["F-104"] && store.settings.ntn && <p className="text-sm text-slate-500">NTN: {store.settings.ntn}</p>}
          {store.features["F-104"] && store.settings.gstNumber && <p className="text-sm text-slate-500">GST/STRN: {store.settings.gstNumber}</p>}
        </div>
        <div className="text-end">
          <p className="text-xl font-bold">{store.features["F-104"] && (store.settings.ntn || store.settings.gstNumber) ? d.taxInvoice : d.invoice}</p>
          <p className="text-sm text-slate-600">#{o.number}</p>
          <p className="text-sm text-slate-600">{new Date(o.createdAt!).toLocaleDateString(dateLocale(lang), { timeZone: "Asia/Karachi" })}</p>
        </div>
      </div>
      <div className="mb-6 text-sm">
        <p className="font-semibold">{d.billTo}</p>
        <p>{o.customer.name}</p>
        {o.customer.address && <p>{o.customer.address}, {o.customer.city}</p>}
        <p>{o.customer.phone} · {o.customer.email}</p>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b-2 border-slate-800 text-left"><th className="py-2">{d.item}</th><th className="text-end">{d.qty}</th><th className="text-end">{d.price}</th><th className="text-end">{d.amount}</th></tr></thead>
        <tbody>
          {o.items.map((i, n) => (
            <tr key={n} className="border-b border-slate-200"><td className="py-2">{i.name}{i.variantName ? ` (${i.variantName})` : ""}{i.custom?.length ? <span className="block text-xs text-slate-500">{i.custom.map((c) => `${c.label}: ${c.value}`).join(" · ")}</span> : null}</td><td className="text-end">{i.qty}</td><td className="text-end">{fm(i.price)}</td><td className="text-end">{fm(i.price * i.qty)}</td></tr>
          ))}
        </tbody>
      </table>
      <dl className="ms-auto mt-4 w-64 space-y-1 text-sm">
        <div className="flex justify-between"><dt>{d.subtotal}</dt><dd>{fm(o.subtotal)}</dd></div>
        {o.discount > 0 && <div className="flex justify-between"><dt>{d.discount}</dt><dd>−{fm(o.discount)}</dd></div>}
        <div className="flex justify-between"><dt>{d.delivery}</dt><dd>{fm(o.shipping)}</dd></div>
        {o.tax > 0 && <div className="flex justify-between"><dt>{d.tax} ({store.settings.taxRate}%)</dt><dd>{fm(o.tax)}</dd></div>}
        {o.giftWrapFee > 0 && <div className="flex justify-between"><dt>{d.giftWrap}</dt><dd>{fm(o.giftWrapFee)}</dd></div>}
        {o.pointsDiscount > 0 && <div className="flex justify-between"><dt>{d.points}</dt><dd>−{fm(o.pointsDiscount)}</dd></div>}
        {o.creditUsed > 0 && <div className="flex justify-between"><dt>{d.credit}</dt><dd>−{fm(o.creditUsed)}</dd></div>}
        {o.giftCardUsed > 0 && <div className="flex justify-between"><dt>{d.giftCard}</dt><dd>−{fm(o.giftCardUsed)}</dd></div>}
        <div className="flex justify-between border-t-2 border-slate-800 pt-1 text-base font-bold"><dt>{d.total}</dt><dd>{fm(o.total)}</dd></div>
        <div className="flex justify-between text-slate-600"><dt>{d.payment}</dt><dd>{o.paymentStatus === "paid" ? d.paid : d.dueOnDelivery}</dd></div>
      </dl>
      <div className="mt-10 print:hidden"><PrintButton label={d.print} /></div>
    </main>
  );
}
