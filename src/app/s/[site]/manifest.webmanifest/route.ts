import { getStore } from "@/lib/tenant";

// F-86: lets shoppers install the store on their phone's home screen.
export async function GET(_: Request, { params }: { params: Promise<{ site: string }> }) {
  const store = await getStore((await params).site);
  if (!store || !store.features["F-86"]) return new Response("Not found", { status: 404 });
  const start = store.base || "/";
  const icon = store.branding.logoUrl;
  return Response.json(
    {
      name: store.name,
      short_name: store.name.slice(0, 12),
      description: store.branding.tagline || store.name,
      start_url: start,
      scope: start,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: store.branding.primaryColor,
      icons: icon ? [{ src: icon, sizes: "512x512", purpose: "any" }] : [{ src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}

export const dynamic = "force-dynamic";
