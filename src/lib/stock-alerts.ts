import "server-only";
import type { StoreContext } from "./tenant";
import type { TenantModels } from "./models/tenant";
import { docLang, docs, emailWrap } from "./doc-i18n";
import { esc, sendEmail } from "./email";

/** F-14: email everyone waiting for a product (or variant) that is back in stock. */
export async function sendBackInStock(store: StoreContext, m: TenantModels, productId: string) {
  if (!store.features["F-14"]) return 0;
  const p = await m.Product.findById(productId).lean();
  if (!p) return 0;
  const alerts = await m.StockAlert.find({ product: p._id, notified: false }).lean();
  let sent = 0;
  for (const a of alerts) {
    const v = a.variant ? p.variants?.find((x) => String(x._id) === String(a.variant)) : undefined;
    const inStock = a.variant ? (v?.stock ?? 0) > 0 : p.variants?.length ? p.variants.some((x) => x.stock > 0) : p.stock > 0;
    if (!inStock) continue;
    const label = v ? `${p.name} (${v.name})` : p.name;
    const lang = docLang(store, a.lang);
    const { f: L } = docs(lang);
    await sendEmail(m, a.email, L("backSubject", { store: store.name, item: label }), emailWrap(lang, `<p>${L("backBody", { item: `<b>${esc(label)}</b>`, store: esc(store.name) })}</p>`));
    await m.StockAlert.updateOne({ _id: a._id }, { $set: { notified: true } });
    sent++;
  }
  return sent;
}
