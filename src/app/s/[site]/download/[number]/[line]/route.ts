import { getStore } from "@/lib/tenant";
import { loadOrderForViewer } from "@/lib/order-view";
import { storeModels } from "@/lib/tenant";
import { canDownload } from "@/lib/order-view";

// F-12: send the buyer to their file. Needs the order's tracking token (or the buyer's session),
// and the store must have confirmed the order.
export async function GET(req: Request, { params }: { params: Promise<{ site: string; number: string; line: string }> }) {
  const { site, number, line } = await params;
  const store = await getStore(site);
  if (!store || !store.features["F-12"]) return new Response("Not found", { status: 404 });
  const token = new URL(req.url).searchParams.get("t") ?? undefined;
  const o = await loadOrderForViewer(store, Number(number), token);
  const it = o?.items[Number(line)];
  if (!o || !it || it.kind !== "digital") return new Response("Not found", { status: 404 });
  if (!canDownload(o)) return new Response("This download unlocks once the store confirms your order.", { status: 403 });
  const p = await (await storeModels(store)).Product.findById(it.product, { digitalFile: 1 }).lean();
  if (!p?.digitalFile?.url) return new Response("The store removed this file. Please contact them.", { status: 410 });
  return Response.redirect(p.digitalFile.url, 302);
}

export const dynamic = "force-dynamic";
