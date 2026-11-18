import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { PrintButton } from "@/components/store/print";

export const metadata = { title: "Packing slip" };

// F-83: printable packing slip with a big address block for the courier.
export default async function Packing({ params }: { params: Promise<{ site: string; number: string }> }) {
  const { site, number } = await params;
  const store = await requireStore(site);
  if (!store.features["F-83"]) notFound();
  await requireStaff(store, "orders");
  const o = await (await storeModels(store)).Order.findOne({ number: Number(number) }).lean();
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900">
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div><p className="text-xl font-bold">{store.name}</p><p className="text-sm">Packing slip</p></div>
        <div className="text-right"><p className="text-3xl font-black">#{o.number}</p><p className="text-sm">{new Date(o.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</p></div>
      </div>
      <div className="my-6 rounded-xl border-2 border-dashed border-slate-900 p-5">
        <p className="text-xs font-bold uppercase">Deliver to</p>
        <p className="text-2xl font-bold">{o.customer.name}</p>
        <p className="text-lg">{o.delivery === "pickup" ? "PICKUP AT SHOP" : `${o.customer.address}, ${o.customer.city}`}</p>
        <p className="text-lg font-semibold">📞 {o.customer.phone}</p>
        {o.deliverySlot && <p>Time: {o.deliverySlot}</p>}
        <p className="mt-2 text-lg font-bold">{o.paymentMethod === "cod" && o.paymentStatus !== "paid" ? `COLLECT CASH: Rs ${o.total.toLocaleString("en-PK")}` : "PAID"}</p>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-900 text-left"><th className="py-1">✓</th><th>Item</th><th className="text-right">Qty</th></tr></thead>
        <tbody>
          {o.items.map((i, n) => (
            <tr key={n} className="border-b border-slate-200"><td className="py-2">☐</td><td>{i.name}{i.variantName ? ` — ${i.variantName}` : ""}</td><td className="text-right text-lg font-bold">{i.qty}</td></tr>
          ))}
        </tbody>
      </table>
      {o.giftWrap && <p className="mt-4 rounded-lg bg-slate-100 p-3">🎁 Gift wrap{o.giftMessage ? ` · Message: “${o.giftMessage}”` : ""}</p>}
      {o.note && <p className="mt-2 text-sm">Note: {o.note}</p>}
      <div className="mt-8 print:hidden"><PrintButton /></div>
    </div>
  );
}
