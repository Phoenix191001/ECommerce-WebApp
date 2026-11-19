import Link from "next/link";
import { requireStore } from "@/lib/tenant";
import { can, requireStaff, type Permission } from "@/lib/store-auth";
import { setPanelLanguage, staffLogout } from "../manage-actions";
import { fill } from "@/lib/i18n";
import { panelPrefs } from "@/lib/panel-i18n";

type Props = { children: React.ReactNode; params: Promise<{ site: string }> };

export default async function ManageLayout({ children, params }: Props) {
  const { site } = await params;
  const store = await requireStore(site);
  const user = await requireStaff(store);
  const f = store.features;
  const { lang, p, dir } = await panelPrefs(store);
  const b = `${store.base}/manage`;
  const nav: { href: string; label: string; icon: string; perm: Permission; show?: boolean; seller?: boolean }[] = [
    { href: `${b}/seller`, label: p.mySales, icon: "🏪", perm: "catalog", show: user.role === "seller", seller: true },
    { href: b, label: p.home, icon: "🏠", perm: "reports" },
    { href: `${b}/orders`, label: p.orders, icon: "🧾", perm: "orders", seller: true },
    { href: `${b}/products`, label: p.products, icon: "📦", perm: "catalog", show: !!f["F-01"], seller: true },
    { href: `${b}/warehouses`, label: p.warehouses, icon: "🏭", perm: "catalog", show: !!f["F-47"] },
    { href: `${b}/purchase-orders`, label: p.purchaseOrders, icon: "📥", perm: "catalog", show: !!f["F-80"] },
    { href: `${b}/customers`, label: p.customers, icon: "👥", perm: "customers" },
    { href: `${b}/returns`, label: p.returns, icon: "↩️", perm: "orders", show: !!f["F-46"] },
    { href: `${b}/support`, label: p.support, icon: "💬", perm: "customers", show: !!f["F-73"] },
    { href: `${b}/chat`, label: p.liveChat, icon: "🗨️", perm: "customers", show: !!f["F-45"] },
    { href: `${b}/discounts`, label: p.discounts, icon: "🏷️", perm: "discounts", show: !!f["F-27"] },
    { href: `${b}/gift-cards`, label: p.giftCards, icon: "🎁", perm: "discounts", show: !!f["F-32"] },
    { href: `${b}/affiliates`, label: p.affiliates, icon: "🤝", perm: "discounts", show: !!f["F-71"] },
    { href: `${b}/sellers`, label: p.sellers, icon: "🏪", perm: "staff", show: !!f["F-67"] },
    { href: `${b}/pos`, label: p.pos, icon: "💵", perm: "pos", show: !!f["F-34"] },
    { href: `${b}/staff`, label: p.staff, icon: "🧑‍🤝‍🧑", perm: "staff", show: !!f["F-48"] },
    { href: `${b}/reports`, label: p.profit, icon: "📈", perm: "reports", show: !!f["F-82"] },
    { href: `${b}/content`, label: p.content, icon: "📝", perm: "settings" },
    { href: `${b}/experiments`, label: p.abTests, icon: "🧪", perm: "settings", show: !!f["F-78"] },
    { href: `${b}/notifications`, label: p.notifications, icon: "🔔", perm: "settings", show: !!f["F-109"] },
    { href: `${b}/apps`, label: p.apps, icon: "🔌", perm: "settings", show: !!f["F-114"] },
    { href: `${b}/features`, label: p.features, icon: "🧩", perm: "features" },
    { href: `${b}/settings`, label: p.settings, icon: "⚙️", perm: "settings" },
    { href: `${b}/activity`, label: p.activity, icon: "📜", perm: "settings", show: !!f["F-122"] },
    { href: `${b}/developers`, label: p.developers, icon: "🧑‍💻", perm: "settings", show: !!f["F-112"] },
  ];
  const items = nav.filter((n) => n.show !== false && can(user.role, n.perm) && (user.role !== "seller" || n.seller));

  return (
    <div dir={dir} lang={lang} className="min-h-screen bg-slate-50 md:flex">
      <aside className="print:hidden bg-gradient-to-b from-emerald-950 via-teal-900 to-cyan-900 text-emerald-50 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg">{store.name[0]}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{store.name}</p>
            <p className="text-[11px] capitalize text-emerald-300">{(p as Record<string, string>)[`role_${user.role}`] ?? user.role} · {fill(p.plan, { plan: store.planName })}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-emerald-50 transition hover:bg-white/10 hover:text-white">
              <span aria-hidden>{n.icon}</span>{n.label}
            </Link>
          ))}
          <a href={store.base || "/"} target="_blank" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-white/10">
            <span aria-hidden>🛒</span>{p.viewStore}
          </a>
          <Link href="/guide" target="_blank" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-white/10">
            <span aria-hidden>📘</span>{p.help}
          </Link>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        {user.imp && (
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2 text-center text-sm font-medium text-white">
            {fill(p.impersonating, { who: user.imp })}
          </div>
        )}
        {store.status === "suspended" && (
          <div className="bg-amber-500 px-6 py-2 text-center text-sm font-medium text-white">{p.suspended}</div>
        )}
        <header className="print:hidden flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-6 py-3 text-sm text-slate-600 backdrop-blur">
          <span className="font-medium text-slate-500">{fill(p.hi, { name: user.name.split(" ")[0] })}</span>
          <div className="flex items-center gap-1">
            <form action={setPanelLanguage.bind(null, site, lang === "ur" ? "en" : "ur")}><button className="rounded-lg px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-50" aria-label={lang === "ur" ? "Switch to English" : "اردو میں دیکھیں"}>🌐 {p.switchLang}</button></form>
            <form action={staffLogout.bind(null, site)}><button className="rounded-lg px-2 py-1 hover:bg-slate-100">{p.signOut}</button></form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
