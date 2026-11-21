import { notFound } from "next/navigation";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { PrintButton } from "@/components/store/print";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Receipt" };

// F-39: narrow receipt for thermal printers.
export default async function Receipt({ params }: { params: Promise<{ site: string; number: string }> }) {
  const { site, number } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  if (!store.features["F-39"]) notFound();
  await requireStaff(store, "pos");
  const o = await (await storeModels(store)).Order.findOne({ number: Number(number) }).lean();
  if (!o) notFound();
  const fm = (n: number) => formatMoney(n, store.currency);
  return (
    <div className="mx-auto max-w-[300px] bg-white p-4 font-mono text-xs">
      <p className="text-center text-sm font-bold">{store.name}</p>
      <p className="text-center">Receipt #{o.number}</p>
      <p className="mb-2 text-center">{new Date(o.createdAt!).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</p>
      <hr className="border-dashed" />
      {o.items.map((i) => (
        <div key={`${i.product}:${i.variant ?? ""}`} className="my-1">
          <p>{i.name}{i.variantName ? ` (${i.variantName})` : ""}</p>
          <p className="flex justify-between"><span>{i.qty} × {fm(i.price)}</span><span>{fm(i.qty * i.price)}</span></p>
        </div>
      ))}
      <hr className="border-dashed" />
      {o.tax > 0 && <p className="flex justify-between"><span>{T("Tax")}</span><span>{fm(o.tax)}</span></p>}
      <p className="flex justify-between text-sm font-bold"><span>{T("TOTAL")}</span><span>{fm(o.total)}</span></p>
      <p className="mt-1">{o.note}</p>
      <p className="mt-3 text-center">{T("Thank you for shopping with us!")}</p>
      <div className="mt-4 text-center print:hidden"><PrintButton label={T("🖨️ Print")} /></div>
    </div>
  );
}
