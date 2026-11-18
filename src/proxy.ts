import { NextResponse, type NextRequest } from "next/server";

// FR-U-02: serve the right instance from the host name.
//   <sub>.<ROOT_DOMAIN>/path  ->  /s/<sub>/path         (rewrite, URL unchanged)
//   <sub>.localhost:3000/path ->  /s/<sub>/path         (local development)
//   shop.example.com/path     ->  /s/shop.example.com/path  (custom domain, F-89)
// The platform itself (landing, admin, guide) is served on the root domain and on *.vercel.app.

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase().split(":")[0];

function storeFromHost(host: string): string | null {
  const h = host.toLowerCase().split(":")[0];
  if (!h || h === "localhost" || h === ROOT || h === `www.${ROOT}`) return null;
  if (h.endsWith(".localhost")) return h.slice(0, -".localhost".length) || null;
  if (h.endsWith(".vercel.app")) return null; // platform deployments and previews
  if (!ROOT.endsWith(".vercel.app") && h.endsWith(`.${ROOT}`)) return h.slice(0, -(ROOT.length + 1));
  return h; // any other host is a store's custom domain
}

export function proxy(req: NextRequest) {
  const site = storeFromHost(req.headers.get("host") ?? "");
  if (!site) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Stores never expose the platform admin panel or platform pages.
  if (pathname.startsWith("/admin") || pathname.startsWith("/start") || pathname.startsWith("/s/"))
    return new NextResponse(null, { status: 404 });

  const url = req.nextUrl.clone();
  url.pathname = `/s/${site}${pathname === "/" ? "" : pathname}`;
  const headers = new Headers(req.headers);
  headers.set("x-store-host", "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
