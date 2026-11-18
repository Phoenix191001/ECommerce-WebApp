import { getStore, storeModels } from "@/lib/tenant";
import { fromPrice, totalStock, visibleFilter } from "@/lib/pricing";
import { absoluteBase, xmlEsc } from "@/lib/store-url";

// F-77: product feed in Google Merchant Center RSS format (also accepted by Meta catalogs).
export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const store = await getStore((await params).site);
  if (!store || store.status !== "active" || !store.features["F-77"] || !store.features["F-01"]) return new Response("Not found", { status: 404 });
  const base = await absoluteBase(store);
  const products = await (await storeModels(store)).Product.find(visibleFilter(store.features)).limit(10000).lean();
  const items = products.map((p) => {
    const price = fromPrice(p, { features: store.features });
    const inStock = !store.features["F-17"] || totalStock(p) > 0;
    return `<item>
  <g:id>${xmlEsc(p.sku || String(p._id))}</g:id>
  <title>${xmlEsc(p.name)}</title>
  <description>${xmlEsc((p.description || p.name).slice(0, 4900))}</description>
  <link>${xmlEsc(`${base}/p/${p.slug}`)}</link>
  ${p.images?.[0] ? `<g:image_link>${xmlEsc(p.images[0])}</g:image_link>` : ""}
  <g:price>${price.toFixed(2)} ${store.currency}</g:price>
  <g:availability>${inStock ? "in_stock" : "out_of_stock"}</g:availability>
  <g:condition>new</g:condition>
  ${p.brand ? `<g:brand>${xmlEsc(p.brand)}</g:brand>` : ""}
  ${p.barcode ? `<g:gtin>${xmlEsc(p.barcode)}</g:gtin>` : "<g:identifier_exists>no</g:identifier_exists>"}
  ${p.category ? `<g:product_type>${xmlEsc(p.category)}</g:product_type>` : ""}
</item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>${xmlEsc(store.name)}</title><link>${xmlEsc(base || "/")}</link><description>${xmlEsc(store.branding.tagline || store.name)}</description>
${items.join("\n")}
</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

export const dynamic = "force-dynamic";
