import Link from "next/link";
import { cookies } from "next/headers";
import { requireStore } from "@/lib/tenant";
import { viewCart } from "@/lib/cart";
import { getStoreSession } from "@/lib/store-auth";
import { CartButton } from "@/components/store/cart";
import { CookieBanner } from "@/components/store/forms";

type Props = { children: React.ReactNode; params: Promise<{ site: string }> };

export default async function ShopLayout({ children, params }: Props) {
  const { site } = await params;
  const store = await requireStore(site);
  const f = store.features;

  if (store.status === "suspended") {
    // FR-A-05: suspended storefront shows a maintenance page.
    return (
      <main className="bg-brand-gradient flex min-h-screen flex-col items-center justify-center px-6 text-center text-white">
        <p className="text-5xl">🛠️</p>
        <h1 className="mt-4 text-3xl font-bold">{store.name}</h1>
        <p className="mt-2 max-w-md text-white/90">We're doing some maintenance right now. Please check back soon.</p>
      </main>
    );
  }

  const [cart, session, jar] = await Promise.all([viewCart(store), getStoreSession(store), cookies()]);
  const b = store.base;
  const wa = store.settings.whatsapp.replace(/[^\d]/g, "");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {f["F-118"] && store.settings.announcement && (
        <div className="bg-brand px-4 py-2 text-center text-sm font-medium text-white">{store.settings.announcement}</div>
      )}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={b || "/"} className="flex items-center gap-2 text-lg font-bold">
            {store.branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.branding.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm text-white">{store.name[0]}</span>
            )}
            <span className="text-brand">{store.name}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3">
            {f["F-51"] && <Link href={`${b}/track`} className="hidden rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 sm:block">Track order</Link>}
            {f["F-22"] && (
              <Link href={`${b}/account${session?.role === "customer" ? "" : "/login"}`} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100">
                {session?.role === "customer" ? "👤 Account" : "Sign in"}
              </Link>
            )}
            {f["F-01"] && <CartButton cart={cart} base={b} site={site} currency={store.currency} drawer={!!f["F-20"]} />}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} {store.name}{store.settings.contactEmail && <> · <a href={`mailto:${store.settings.contactEmail}`} className="hover:underline">{store.settings.contactEmail}</a></>}</p>
          <div className="flex gap-4">
            {f["F-51"] && <Link href={`${b}/track`} className="hover:underline">Track an order</Link>}
            <Link href={`${b}/manage`} className="hover:underline">Staff sign in</Link>
          </div>
        </div>
      </footer>
      {f["F-54"] && wa && (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${store.name}, I'd like to order`)}`}
          target="_blank"
          rel="noopener"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-xl hover:brightness-110"
        >
          💬 Order on WhatsApp
        </a>
      )}
      {f["F-79"] && !jar.get("cc") && <CookieBanner />}
    </div>
  );
}
