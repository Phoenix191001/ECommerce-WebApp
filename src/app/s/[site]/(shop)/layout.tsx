import Link from "next/link";
import Script from "next/script";
import { cookies } from "next/headers";
import { requireStore } from "@/lib/tenant";
import { viewCart } from "@/lib/cart";
import { getStoreSession } from "@/lib/store-auth";
import { storePrefs } from "@/lib/store-prefs";
import { CartButton } from "@/components/store/cart";
import { CookieBanner } from "@/components/store/forms";
import { CurrencyPicker, NewsletterForm, PrefToggles } from "@/components/store/extras";
import { displayCurrency } from "@/lib/currency";
import { StoreApps } from "@/components/store/apps";
import { ChatWidget } from "@/components/store/chat";
import { activeApps } from "@/lib/apps";
import { recentSales } from "@/lib/recent-sales";
import { abVariants } from "@/lib/ab";
import { storeModels } from "@/lib/tenant";
import { PushOptIn } from "@/components/store/push";
import { pushConfigured, pushPublicKey } from "@/lib/push";

type Props = { children: React.ReactNode; params: Promise<{ site: string }> };

const safeId = (v: string, re: RegExp) => (re.test(v) ? v : "");

export default async function ShopLayout({ children, params }: Props) {
  const { site } = await params;
  const store = await requireStore(site);
  const f = store.features;
  const { t, lang, dir, dark, langs } = await storePrefs(store);

  if (store.status === "suspended") {
    // FR-A-05: suspended storefront shows a maintenance page.
    return (
      <main lang={lang} dir={dir} className="bg-brand-gradient flex min-h-screen flex-col items-center justify-center px-6 text-center text-white">
        <p className="text-5xl">🛠️</p>
        <h1 className="mt-4 text-3xl font-bold">{store.name}</h1>
        <p className="mt-2 max-w-md text-white/90">{t.maintenance}</p>
      </main>
    );
  }

  const [cart, session, jar] = await Promise.all([viewCart(store), getStoreSession(store), cookies()]);
  const b = store.base;
  const wa = store.settings.whatsapp.replace(/[^\d]/g, "");
  const consent = !f["F-79"] || jar.get("cc")?.value === "1";
  const gaId = f["F-76"] ? safeId(store.settings.gaId, /^G-[A-Z0-9]{4,15}$/) : "";
  const pixelId = f["F-76"] ? safeId(store.settings.pixelId, /^\d{8,20}$/) : "";
  const menu = f["F-117"] ? store.settings.menu.filter((m) => m.label && /^(\/|https?:\/\/)/.test(m.url)).slice(0, 8) : [];
  const link = (u: string) => (u.startsWith("/") ? `${b}${u === "/" ? "" : u}` || "/" : u);
  const ab = f["F-78"] ? await abVariants(await storeModels(store), false) : {};
  const announcement = ab.announcement ?? store.settings.announcement;
  const cur = await displayCurrency(store);
  const currencies = f["F-55"] ? store.settings.currencies.map((c) => c.code) : [];
  const apps = f["F-114"] ? store.settings.apps : [];
  const salesPop = activeApps(apps).some((a) => a.id === "salespop") ? await recentSales(store) : [];

  return (
    <div lang={lang} dir={dir} className={`flex min-h-screen flex-col bg-slate-50 text-slate-900 ${dark ? "store-dark" : ""}`}>
      {f["F-86"] && <link rel="manifest" href={`${b}/manifest.webmanifest`} />}
      {f["F-115"] && store.settings.customCss && (
        // Owner-provided CSS; "</" is stripped so it cannot close the style tag.
        <style dangerouslySetInnerHTML={{ __html: store.settings.customCss.replace(/<\//g, "") }} />
      )}
      {(f["F-118"] || ab.announcement) && announcement && (
        <div className="bg-brand px-4 py-2 text-center text-sm font-medium text-white">{announcement}</div>
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
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            {menu.map((m) => (
              <Link key={m.label + m.url} href={link(m.url)} className="hidden rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 md:block">{m.label}</Link>
            ))}
            {f["F-40"] && <Link href={`${b}/blog`} className="hidden rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 md:block">{t.blog}</Link>}
            {f["F-51"] && <Link href={`${b}/track`} className="hidden rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 sm:block">{t.trackOrder}</Link>}
            {currencies.length > 0 && <CurrencyPicker site={site} base={store.currency} current={cur?.code ?? ""} options={currencies} />}
            <PrefToggles site={site} lang={lang} dark={dark} langs={langs} showDark={!!f["F-87"]} L={t} />
            {f["F-22"] && (
              <Link href={`${b}/account${session?.role === "customer" ? "" : "/login"}`} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100">
                {session?.role === "customer" ? `👤 ${t.account}` : t.signIn}
              </Link>
            )}
            {f["F-01"] && <CartButton cart={cart} base={b} site={site} currency={store.currency} drawer={!!f["F-20"]} L={t} cur={cur} />}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-4 py-8 text-sm text-slate-500">
          <div className="space-y-2">
            <p>© {new Date().getFullYear()} {store.name}{store.settings.contactEmail && <> · <a href={`mailto:${store.settings.contactEmail}`} className="hover:underline">{store.settings.contactEmail}</a></>}</p>
            <div className="flex flex-wrap gap-4">
              {f["F-51"] && <Link href={`${b}/track`} className="hover:underline">{t.trackAnOrder}</Link>}
              {f["F-40"] && <Link href={`${b}/blog`} className="hover:underline">{t.blog}</Link>}
              {f["F-88"] && store.settings.locations.length > 0 && <Link href={`${b}/locations`} className="hover:underline">{t.locations}</Link>}
              {f["F-11"] && <Link href={`${b}/compare`} className="hover:underline">{t.compareProducts}</Link>}
              <Link href={`${b}/manage`} className="hover:underline">{t.staffSignIn}</Link>
            </div>
          </div>
          <div className="space-y-3">
            {f["F-44"] && <NewsletterForm site={site} L={t} />}
            {f["F-109"] && pushConfigured() && <PushOptIn site={site} publicKey={pushPublicKey()} marketing L={t} />}
          </div>
        </div>
      </footer>
      {f["F-54"] && wa && (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${store.name}, I'd like to order`)}`}
          target="_blank"
          rel="noopener"
          className="fixed bottom-5 end-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-xl hover:brightness-110"
        >
          💬 {t.orderOnWhatsapp}
        </a>
      )}
      {f["F-79"] && !jar.get("cc") && <CookieBanner text={t.cookie} accept={t.accept} />}
      {apps.length > 0 && <StoreApps apps={apps} consent={consent} sales={salesPop} />}
      {f["F-45"] && <ChatWidget site={site} L={t} signedIn={session?.role === "customer"} raised={!!(f["F-54"] && wa)} />}
      {consent && gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');`}</Script>
        </>
      )}
      {consent && pixelId && (
        <Script id="fbq" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}</Script>
      )}
    </div>
  );
}
