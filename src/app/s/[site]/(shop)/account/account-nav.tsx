import Link from "next/link";
import type { StoreContext } from "@/lib/tenant";

export function AccountNav({ store, active }: { store: StoreContext; active: string }) {
  const f = store.features;
  const b = `${store.base}/account`;
  const items = [
    { href: b, key: "home", label: "🏠 Overview", show: true },
    { href: `${b}/addresses`, key: "addresses", label: "📍 Addresses", show: !!f["F-107"] },
    { href: `${b}/returns`, key: "returns", label: "↩️ Returns", show: !!f["F-46"] },
    { href: `${b}/support`, key: "support", label: "💬 Support", show: !!f["F-73"] },
    { href: `${b}/security`, key: "security", label: "🔐 Security", show: !!f["F-69"] },
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
