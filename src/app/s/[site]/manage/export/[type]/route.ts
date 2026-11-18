import { getStore, storeModels } from "@/lib/tenant";
import { can, getCurrentUser } from "@/lib/store-auth";

// F-50: export orders and products as CSV.
const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // avoid spreadsheet formula injection
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\n");

export async function GET(_: Request, { params }: { params: Promise<{ site: string; type: string }> }) {
  const { site, type } = await params;
  const store = await getStore(site);
  if (!store || !store.features["F-50"]) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser(store);
  const m = await storeModels(store);
  let body = "";
  if (type === "orders") {
    if (!can(user?.role, "orders")) return new Response("Sign in as staff first.", { status: 401 });
    const orders = await m.Order.find().sort({ createdAt: -1 }).limit(20000).lean();
    body = csv([
      ["number", "date", "channel", "status", "payment", "payment_status", "customer", "email", "phone", "city", "items", "subtotal", "discount", "shipping", "tax", "total"],
      ...orders.map((o) => [o.number, o.createdAt?.toISOString(), o.channel, o.status, o.paymentMethod, o.paymentStatus, o.customer.name, o.customer.email, o.customer.phone, o.customer.city,
        o.items.map((i) => `${i.name} x${i.qty}`).join("; "), o.subtotal, o.discount, o.shipping, o.tax, o.total]),
    ]);
  } else if (type === "products") {
    if (!can(user?.role, "catalog")) return new Response("Sign in as staff first.", { status: 401 });
    const products = await m.Product.find().sort({ name: 1 }).lean();
    body = csv([
      ["name", "slug", "price", "compare_at_price", "stock", "category", "brand", "sku", "barcode", "status", "images"],
      ...products.map((p) => [p.name, p.slug, p.price, p.compareAtPrice ?? "", p.stock, p.category, p.brand, p.sku, p.barcode, p.status, p.images.join(" ")]),
    ]);
  } else return new Response("Not found", { status: 404 });
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${store.subdomain}-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
