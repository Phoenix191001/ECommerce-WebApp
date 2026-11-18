import Link from "next/link";
import type { StoreContext } from "@/lib/tenant";
import type { Dict } from "@/lib/i18n";

export function AccountNav({ store, active, L }: { store: StoreContext; active: string; L: Dict }) {
  const f = store.features;
  const b = `${store.base}/account`;
  const items = [
    { href: b, key: "home", label: L.navOverview, show: true },
    { href: `${b}/addresses`, key: "addresses", label: L.navAddresses, show: !!f["F-107"] },
    { href: `${b}/returns`, key: "returns", label: L.navReturns, show: !!f["F-46"] },
    { href: `${b}/support`, key: "support", label: L.navSupport, show: !!f["F-73"] },
    { href: `${b}/security`, key: "security", label: L.navSecurity, show: !!f["F-69"] },
  ].filter((i) => i.show);
  if (items.length < 2) return null;
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active === i.key ? "bg-brand text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>{i.label}</Link>
      ))}
    </nav>
  );
}
