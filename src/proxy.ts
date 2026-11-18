import { NextResponse, type NextRequest } from "next/server";

// FR-U-02: serve the right instance from the host name.
//   <sub>.<ROOT_DOMAIN>/path  ->  /s/<sub>/path   (rewrite, URL unchanged)
//   <sub>.localhost:3000/path ->  /s/<sub>/path   (local development)
// The platform itself (admin panel, landing page) is served on the root domain.
// Until a wildcard domain is attached on Vercel, stores are also reachable at /s/<sub>.

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();

function subdomainFromHost(host: string): string | null {
  const h = host.toLowerCase();
  const rootHost = ROOT.split(":")[0];
  const bare = h.split(":")[0];

  if (bare.endsWith(".localhost")) return bare.slice(0, -".localhost".length) || null;
  if (rootHost.endsWith(".vercel.app")) return null; // vercel.app has no wildcard subdomains
  if (bare !== rootHost && bare.endsWith(`.${rootHost}`)) {
    const sub = bare.slice(0, -(rootHost.length + 1));
    return sub === "www" ? null : sub;
  }
  return null;
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const sub = subdomainFromHost(host);
  const { pathname } = req.nextUrl;

  if (sub) {
    // Stores never expose the platform admin panel.
    if (pathname.startsWith("/admin")) return new NextResponse(null, { status: 404 });
    const url = req.nextUrl.clone();
    url.pathname = `/s/${sub}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
