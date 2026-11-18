import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/instances/new", label: "New store", icon: "➕" },
  { href: "/admin/plans", label: "Plans", icon: "💎" },
  { href: "/guide", label: "Feature guide", icon: "📘" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="bg-gradient-to-b from-indigo-950 via-indigo-900 to-violet-900 text-indigo-100 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-lg shadow-lg">🛍️</span>
          <div>
            <p className="text-sm font-bold text-white">Platform Admin</p>
            <p className="text-[11px] text-indigo-300">Super Admin</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-indigo-100 transition hover:bg-white/10 hover:text-white">
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-6 py-3 text-sm text-slate-600 backdrop-blur">
          <span className="hidden font-medium text-slate-500 sm:block">Multi-Tenant Ecommerce Platform</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
                {admin.email[0]?.toUpperCase()}
              </span>
              <span className="hidden sm:inline">{admin.email}</span>
            </span>
            <form action={logout}>
              <button className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100">Sign out</button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
