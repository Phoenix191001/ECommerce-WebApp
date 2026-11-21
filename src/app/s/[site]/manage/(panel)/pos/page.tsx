import { notFound } from "next/navigation";
import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card } from "@/components/admin/ui";
import { CloseShiftForm, OpenShiftForm, PosScreen } from "@/components/manage/pos";
import { loadParts, sellableStock } from "@/lib/cart";
import { unitPrice } from "@/lib/pricing";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Point of sale" };

export default async function PosPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  if (!store.features["F-34"]) notFound();
  const user = await requireStaff(store, "pos");
  const m = await storeModels(store);
  const f = store.features;
  const shift = f["F-36"] ? await m.Shift.findOne({ cashier: user._id, closedAt: { $exists: false } }).lean() : null;

  if (f["F-36"] && !shift) {
    return (
      <div className="mx-auto max-w-sm">
        <Card title={T("💵 Open your shift")} accent="emerald">
          <p className="mb-4 text-sm text-slate-600">{T("Count the cash in the drawer before your first sale. At the end, you'll count it again and see any difference.")}</p>
          <OpenShiftForm site={site} />
        </Card>
      </div>
    );
  }

  const products = await m.Product.find({ status: "active", kind: { $ne: "digital" } }).sort({ name: 1 }).limit(2000).lean();
  const parts = await loadParts(store, products);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{T("💵 Point of sale")}</h1>
        {shift && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
            <span>Shift since {new Date(shift.openedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", timeStyle: "short" })} · sales {formatMoney(shift.cashSales, store.currency)}</span>
            <CloseShiftForm site={site} currency={store.currency} />
          </div>
        )}
      </div>
      <PosScreen
        site={site}
        currency={store.currency}
        taxRate={f["F-31"] ? store.settings.taxRate : 0}
        barcode={!!f["F-35"]}
        trackStock={!!f["F-17"]}
        receiptBase={f["F-39"] ? `${store.base}/manage/pos/receipt` : null}
        refunds={!!f["F-37"]}
        offline={!!f["F-85"]}
        products={products.flatMap((p) =>
          f["F-02"] && p.variants?.length
            ? p.variants.map((v) => ({
                id: String(p._id), variant: String(v._id), key: `${p._id}:${v._id}`, name: `${p.name} — ${v.name}`,
                price: unitPrice(p, String(v._id), 1, { features: f }).price, barcode: v.barcode || "", sku: v.sku || "", stock: v.stock,
              }))
            : [{ id: String(p._id), key: String(p._id), name: p.name, price: unitPrice(p, null, 1, { features: f }).price, barcode: p.barcode ?? "", sku: p.sku ?? "", stock: sellableStock(p, undefined, parts, f) }],
        )}
      />
    </>
  );
}
