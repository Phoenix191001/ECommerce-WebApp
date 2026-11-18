import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { getStoreSession } from "@/lib/store-auth";
import { LoginForm } from "@/components/store/forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-22"]) notFound();
  if ((await getStoreSession(store))?.role === "customer") redirect(`${store.base}/account`);
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">Sign in to see your orders and wishlist.</p>
        <LoginForm site={site} />
        <p className="mt-5 text-center text-sm text-slate-600">New here? <Link href={`${store.base}/account/register`} className="text-brand font-semibold underline">Create an account</Link></p>
      </div>
    </main>
  );
}
