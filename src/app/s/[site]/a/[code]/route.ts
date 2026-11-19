import { cookies } from "next/headers";
import { getStore, storeModels } from "@/lib/tenant";
import { AFF_DAYS, affCookie } from "@/lib/affiliates";

// F-71: /a/<CODE> remembers the affiliate for 30 days and sends the visitor to the store.
export async function GET(req: Request, { params }: { params: Promise<{ site: string; code: string }> }) {
  const { site, code } = await params;
  const store = await getStore(site);
  const home = new URL(store?.base || "/", req.url);
  if (!store || !store.features["F-71"]) return Response.redirect(home, 302);
  const c = decodeURIComponent(code).toUpperCase();
  if (/^[A-Z0-9-]{3,30}$/.test(c)) {
    const r = await (await storeModels(store)).Affiliate.updateOne({ code: c, status: "active" }, { $inc: { clicks: 1 } });
    if (r.matchedCount) (await cookies()).set(affCookie(store), c, { path: "/", sameSite: "lax", httpOnly: true, maxAge: AFF_DAYS * 86400 });
  }
  const to = new URL(req.url).searchParams.get("to");
  return Response.redirect(new URL(to && /^\/[^/\\]/.test(to) ? `${store.base}${to}` : home.pathname, req.url), 302);
}

export const dynamic = "force-dynamic";
