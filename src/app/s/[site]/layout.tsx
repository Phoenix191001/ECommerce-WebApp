import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/tenant";
import { storeTheme, themeVars } from "@/lib/theme";

export const dynamic = "force-dynamic";

type Props = { children: React.ReactNode; params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getStore((await params).site);
  if (!store) return { title: "Store not found" };
  const seo = store.features["F-75"];
  return {
    title: { default: (seo && store.settings.seoTitle) || store.name, template: `%s · ${store.name}` },
    description: (seo && store.settings.seoDescription) || store.branding.tagline || undefined,
  };
}

export default async function StoreRoot({ children, params }: Props) {
  const store = await getStore((await params).site);
  if (!store) notFound();
  return (
    <div className="min-h-screen w-full" style={(() => { const th = storeTheme(store); return th ? themeVars(th) : { ["--brand" as string]: store.branding.primaryColor }; })()}>
      {children}
    </div>
  );
}
