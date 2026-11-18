import { notFound } from "next/navigation";
import { formatMoney, requireStore } from "@/lib/tenant";
import { loadOrderForViewer } from "@/lib/order-view";
import { PrintButton } from "@/components/store/print";

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
  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-10 print:px-0">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-brand text-2xl font-bold">{store.name}</h1>
          {store.settings.contactEmail && <p className="text-sm text-slate-500">{store.settings.contactEmail}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">INVOICE</p>
          <p className="text-sm text-slate-600">#{o.number}</p>
          <p className="text-sm text-slate-600">{new Date(o.createdAt!).toLocaleDateString("en-GB")}</p>
        </div>
      </div>
      <div className="mb-6 text-sm">
        <p className="font-semibold">Bill to</p>
        <p>{o.customer.name}</p>
        {o.customer.address && <p>{o.customer.address}, {o.customer.city}</p>}
        <p>{o.customer.phone} · {o.customer.email}</p>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b-2 border-slate-800 text-left"><th className="py-2">Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={String(i.product)} className="border-b border-slate-200"><td className="py-2">{i.name}</td><td className="text-right">{i.qty}</td><td className="text-right">{fm(i.price)}</td><td className="text-right">{fm(i.price * i.qty)}</td></tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{fm(o.subtotal)}</dd></div>
        {o.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{fm(o.discount)}</dd></div>}
        <div className="flex justify-between"><dt>Delivery</dt><dd>{fm(o.shipping)}</dd></div>
        {o.tax > 0 && <div className="flex justify-between"><dt>Tax ({store.settings.taxRate}%)</dt><dd>{fm(o.tax)}</dd></div>}
        <div className="flex justify-between border-t-2 border-slate-800 pt-1 text-base font-bold"><dt>Total</dt><dd>{fm(o.total)}</dd></div>
        <div className="flex justify-between text-slate-600"><dt>Payment</dt><dd>{o.paymentStatus === "paid" ? "Paid" : "Due on delivery"}</dd></div>
      </dl>
      <div className="mt-10 print:hidden"><PrintButton /></div>
    </main>
  );
}
