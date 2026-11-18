import { getStore, storeModels } from "@/lib/tenant";
import { visibleFilter } from "@/lib/pricing";
import { absoluteBase, xmlEsc } from "@/lib/store-url";

// F-75: sitemap for search engines.
export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const store = await getStore((await params).site);
  if (!store || store.status !== "active" || !store.features["F-75"]) return new Response("Not found", { status: 404 });
  const base = await absoluteBase(store);
  const m = await storeModels(store);
  const [products, pages] = await Promise.all([
    store.features["F-01"] ? m.Product.find(visibleFilter(store.features), { slug: 1, updatedAt: 1 }).limit(10000).lean<{ slug: string; updatedAt?: Date }[]>() : Promise.resolve([]),
    store.features["F-40"] ? m.Page.find({ published: true }, { slug: 1, kind: 1, updatedAt: 1 }).lean<{ slug: string; kind: string; updatedAt?: Date }[]>() : Promise.resolve([]),
  ]);
  const urls: { loc: string; mod?: Date }[] = [
    { loc: base || "/" },
    ...products.map((p) => ({ loc: `${base}/p/${p.slug}`, mod: p.updatedAt })),
    ...pages.map((p) => ({ loc: `${base}/${p.kind === "post" ? "blog" : "pages"}/${p.slug}`, mod: p.updatedAt })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${xmlEsc(u.loc)}</loc>${u.mod ? `<lastmod>${new Date(u.mod).toISOString()}</lastmod>` : ""}</url>`)
    .join("\n")}\n</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

export const dynamic = "force-dynamic";
