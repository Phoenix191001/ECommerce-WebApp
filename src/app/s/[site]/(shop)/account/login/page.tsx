import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { getStoreSession } from "@/lib/store-auth";
import { LoginForm } from "@/components/store/forms";
import { storePrefs } from "@/lib/store-prefs";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-22"]) notFound();
  if ((await getStoreSession(store))?.role === "customer") redirect(`${store.base}/account`);
  const { t } = await storePrefs(store);
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{t.welcomeBack}</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">{t.signInSub}</p>
        <LoginForm site={site} t={t} />
        <p className="mt-5 text-center text-sm text-slate-600">{t.newHere} <Link href={`${store.base}/account/register`} className="text-brand font-semibold underline">{t.createAnAccount}</Link></p>
      </div>
    </main>
  );
}
