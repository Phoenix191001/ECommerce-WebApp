import { notFound, redirect } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { totpQr } from "@/lib/totp";
import { TwoFactorConfirm } from "@/components/store/extras";
import { setCustomerTwoFactor } from "../../../shop-actions";
import { AccountNav } from "../account-nav";

export const metadata = { title: "Security" };

// F-69: optional two-factor sign-in for customers.
export default async function Security({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-22"] || !store.features["F-69"]) notFound();
  const user = await getCurrentUser(store);
  if (!user || user.role !== "customer") redirect(`${store.base}/account/login`);
  const qr = user.totpSecret && !user.totpEnabled ? await totpQr(user.totpSecret, `${store.name}: ${user.email}`) : null;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">🔐 Security</h1>
      <AccountNav store={store} active="security" />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Two-factor sign-in</h2>
        {user.totpEnabled ? (
          <>
            <p className="mt-1 text-sm text-emerald-700">✅ On. You&apos;ll enter a code from your authenticator app when you sign in.</p>
            <form action={setCustomerTwoFactor.bind(null, site, false)} className="mt-3"><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Turn off</button></form>
          </>
        ) : qr ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>Scan this code with an authenticator app, then enter the 6-digit code it shows.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.dataUrl} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl border border-slate-200 p-2" />
            <details><summary className="cursor-pointer text-xs text-slate-500">Can&apos;t scan? Enter this key</summary><code className="mt-1 block break-all rounded bg-slate-100 p-2 text-xs">{user.totpSecret}</code></details>
            <TwoFactorConfirm site={site} />
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">Add a second step when you sign in, using an app like Google Authenticator.</p>
            <form action={setCustomerTwoFactor.bind(null, site, true)} className="mt-3"><button className="btn-brand">Set up two-factor sign-in</button></form>
          </>
        )}
      </section>
    </main>
  );
}
