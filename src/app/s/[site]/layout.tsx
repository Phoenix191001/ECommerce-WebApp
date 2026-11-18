import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = { children: React.ReactNode; params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getStore((await params).site);
  return { title: store?.name ?? "Store not found", description: store?.branding.tagline };
}

export default async function StoreLayout({ children, params }: Props) {
  const { site } = await params;
  const store = await getStore(site);
  if (!store) notFound();

  if (store.status === "suspended") {
    // FR-A-05: suspended storefront shows a maintenance page.
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">{store.name}</h1>
        <p className="mt-2 max-w-md text-gray-600">
          This store is temporarily unavailable for maintenance. Please check back soon.
        </p>
      </main>
    );
  }

  const color = store.branding.primaryColor;
  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ ["--brand" as string]: color }}>
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href={`/s/${store.subdomain}`} className="text-lg font-semibold" style={{ color }}>
            {store.name}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {store.features["F-22"] && <span className="text-gray-600">Account</span>}
            <span className="rounded-full px-3 py-1 text-white" style={{ background: color }} aria-label="Cart, 0 items">
              Cart (0)
            </span>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-gray-200 py-8 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {store.name}
      </footer>
    </div>
  );
}
