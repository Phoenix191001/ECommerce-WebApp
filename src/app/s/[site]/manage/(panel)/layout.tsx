import Link from "next/link";
import { getStore } from "@/lib/tenant";
import { can, requireStaff, type Permission } from "@/lib/store-auth";
import { staffLogout } from "../manage-actions";

type Props = { children: React.ReactNode; params: Promise<{ site: string }> };

export default async function ManageLayout({ children, params }: Props) {
  const { site } = await params;
  const store = (await getStore(site))!;
  const user = await requireStaff(store);
  const f = store.features;
  const b = `${store.base}/manage`;
  const nav: { href: string; label: string; icon: string; perm: Permission; show?: boolean }[] = [
    { href: b, label: "Home", icon: "🏠", perm: "reports" },
    { href: `${b}/orders`, label: "Orders", icon: "🧾", perm: "orders" },
    { href: `${b}/products`, label: "Products", icon: "📦", perm: "catalog", show: !!f["F-01"] },
    { href: `${b}/customers`, label: "Customers", icon: "👥", perm: "customers" },
    { href: `${b}/discounts`, label: "Discounts", icon: "🏷️", perm: "discounts", show: !!f["F-27"] },
    { href: `${b}/pos`, label: "POS", icon: "💵", perm: "pos", show: !!f["F-34"] },
    { href: `${b}/staff`, label: "Staff", icon: "🧑‍🤝‍🧑", perm: "staff", show: !!f["F-48"] },
    { href: `${b}/features`, label: "Features", icon: "🧩", perm: "features" },
    { href: `${b}/settings`, label: "Settings", icon: "⚙️", perm: "settings" },
    { href: `${b}/activity`, label: "Activity", icon: "📜", perm: "settings", show: !!f["F-122"] },
  ];
  const items = nav.filter((n) => n.show !== false && can(user.role, n.perm));

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="print:hidden bg-gradient-to-b from-emerald-950 via-teal-900 to-cyan-900 text-emerald-50 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg">{store.name[0]}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{store.name}</p>
            <p className="text-[11px] capitalize text-emerald-300">{user.role} · {store.planName} plan</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-emerald-50 transition hover:bg-white/10 hover:text-white">
              <span aria-hidden>{n.icon}</span>{n.label}
            </Link>
          ))}
          <a href={store.base || "/"} target="_blank" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-white/10">
            <span aria-hidden>🛒</span>View store ↗
          </a>
          <Link href="/guide" target="_blank" className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-white/10">
            <span aria-hidden>📘</span>Help & guide ↗
          </Link>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        {user.imp && (
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2 text-center text-sm font-medium text-white">
            👀 You're signed in as the store owner from the platform admin ({user.imp}). Everything you do here is recorded.
          </div>
        )}
        {store.status === "suspended" && (
          <div className="bg-amber-500 px-6 py-2 text-center text-sm font-medium text-white">⏸️ This store is suspended by the platform. Customers see a maintenance page.</div>
        )}
        <header className="print:hidden flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-6 py-3 text-sm text-slate-600 backdrop-blur">
          <span className="font-medium text-slate-500">Hi, {user.name.split(" ")[0]} 👋</span>
          <form action={staffLogout.bind(null, site)}><button className="rounded-lg px-2 py-1 hover:bg-slate-100">Sign out</button></form>
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
