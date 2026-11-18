import { getStore } from "@/lib/tenant";
import { absoluteBase } from "@/lib/store-url";

export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const store = await getStore((await params).site);
  if (!store) return new Response("Not found", { status: 404 });
  const base = await absoluteBase(store);
  const lines = ["User-agent: *", `Disallow: ${store.base}/manage`, `Disallow: ${store.base}/account`, `Disallow: ${store.base}/checkout`, `Disallow: ${store.base}/cart`];
  if (store.features["F-75"]) lines.push(`Sitemap: ${base}/sitemap.xml`);
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain" } });
}

export const dynamic = "force-dynamic";
