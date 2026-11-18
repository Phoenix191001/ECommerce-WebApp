import { redirect } from "next/navigation";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { getAdmin, getPendingAdmin } from "@/lib/auth";
import { totpQr } from "@/lib/totp";
import { TwoFactorForm } from "@/components/admin/forms";
import { AuthShell } from "@/components/admin/auth-shell";

export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  if (await getAdmin()) redirect("/admin");
  const pending = await getPendingAdmin();
  if (!pending) redirect("/admin/login");
  const { SuperAdmin } = platformModels(await platformDb());
  const admin = await SuperAdmin.findOne({ email: pending.email }).lean();
  if (!admin?.totpSecret) redirect("/admin/login");

  if (admin.totpEnabled) {
    return (
      <AuthShell title="Two-factor check" subtitle="Open your authenticator app and enter the 6-digit code for Ecommerce Platform.">
        <TwoFactorForm />
      </AuthShell>
    );
  }

  const { dataUrl } = await totpQr(admin.totpSecret, admin.email);
  return (
    <AuthShell
      title="Turn on two-factor sign-in"
      subtitle="The Super Admin account must use two-factor sign-in. It takes a minute."
      step="Step 2 of 2"
    >
      <ol className="mb-5 space-y-3 text-sm text-slate-700">
        <li><b className="text-indigo-700">1.</b> Install an authenticator app such as Google Authenticator, Microsoft Authenticator, or 1Password.</li>
        <li><b className="text-indigo-700">2.</b> In the app, add an account and scan this code:</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="QR code for your authenticator app" width={180} height={180} className="mx-auto rounded-xl border border-slate-200 p-2" />
      <details className="mt-2 text-center text-xs text-slate-500">
        <summary className="cursor-pointer">Can't scan? Enter this key instead</summary>
        <code className="mt-1 block break-all rounded bg-slate-100 p-2 font-mono text-slate-800">{admin.totpSecret}</code>
      </details>
      <p className="my-4 text-sm text-slate-700"><b className="text-indigo-700">3.</b> Enter the 6-digit code the app shows:</p>
      <TwoFactorForm />
    </AuthShell>
  );
}
