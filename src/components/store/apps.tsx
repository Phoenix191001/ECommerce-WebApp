import Script from "next/script";
import { activeApps, type Installed } from "@/lib/apps";
import { SalesPop } from "./sales-pop";

/** F-114: storefront side of installed apps. Values were validated against each app's pattern. */
export function StoreApps({ apps, consent, sales }: { apps: Installed[]; consent: boolean; sales: { city: string; name: string; ago: number }[] }) {
  const on = activeApps(apps);
  const cfg = (id: string) => on.find((a) => a.id === id)?.config;
  const tawk = cfg("tawk"), gtm = cfg("gtm"), clarity = cfg("clarity"), tiktok = cfg("tiktok");
  return (
    <>
      {cfg("salespop") && sales.length > 0 && <SalesPop sales={sales} />}
      {consent && tawk && <Script id="tawk" strategy="lazyOnload" src={`https://embed.tawk.to/${tawk.property}/${tawk.widget}`} />}
      {consent && gtm && <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm.id}');`}</Script>}
      {consent && clarity && <Script id="clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity.id}");`}</Script>}
      {consent && tiktok && <Script id="ttq" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._u=i;var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok.id}');ttq.page();}(window,document,'ttq');`}</Script>}
    </>
  );
}
