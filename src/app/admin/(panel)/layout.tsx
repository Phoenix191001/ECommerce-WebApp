import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Instances" },
  { href: "/admin/instances/new", label: "New instance" },
  { href: "/admin/plans", label: "Plans" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <aside className="border-b border-gray-200 bg-white md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="px-5 py-4 text-sm font-semibold text-gray-900">Platform Admin</div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-3 text-sm text-gray-600">
          <span>{admin.email}</span>
          <form action={logout}>
            <button className="rounded-md px-2 py-1 hover:bg-gray-100">Sign out</button>
          </form>
        </header>
        <main className="mx-auto max-w-5xl space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
