import { notFound, redirect } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { AddressForm } from "@/components/store/extras";
import { removeAddress } from "../../../shop-actions";
import { AccountNav } from "../account-nav";

export const metadata = { title: "Addresses" };

export default async function Addresses({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-22"] || !store.features["F-107"]) notFound();
  const user = await getCurrentUser(store);
  if (!user || user.role !== "customer") redirect(`${store.base}/account/login`);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">📍 Saved addresses</h1>
      <AccountNav store={store} active="addresses" />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        {user.addresses.length === 0 ? <p className="text-sm text-slate-500">No saved addresses yet. You can also save one at checkout.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {user.addresses.map((a) => (
              <li key={String(a._id)} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-semibold">{a.label}</p>
                <p className="text-slate-600">{a.address}, {a.city}</p>
                {a.phone && <p className="text-slate-500">{a.phone}</p>}
                <form action={removeAddress.bind(null, site, String(a._id))}><button className="mt-1 text-xs text-rose-600 hover:underline">Remove</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Add an address</h2>
        <AddressForm site={site} />
      </section>
    </main>
  );
}
