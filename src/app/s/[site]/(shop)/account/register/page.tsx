import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { RegisterForm } from "@/components/store/forms";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { site } = await params;
  const { ref } = await searchParams;
  const store = await requireStore(site);
  if (!store.features["F-22"]) notFound();
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">Track orders, save a wishlist, and check out faster.</p>
        <RegisterForm site={site} referral={!!store.features["F-70"]} newsletter={!!store.features["F-44"]} refCode={ref?.slice(0, 20)} />
        <p className="mt-5 text-center text-sm text-slate-600">Already have one? <Link href={`${store.base}/account/login`} className="text-brand font-semibold underline">Sign in</Link></p>
      </div>
    </main>
  );
}
