import { requireStore } from "@/lib/tenant";
import { OwnerSetupForm } from "@/components/manage/forms";
import { ManageAuthShell } from "@/components/manage/shell";

export const metadata = { title: "Set up your store" };

export default async function OwnerSetup({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ token?: string }> }) {
  const { site } = await params;
  const { token } = await searchParams;
  const store = await requireStore(site);
  return (
    <ManageAuthShell store={store} title={`Welcome to ${store.name} 🎉`} subtitle="Choose a password for your owner account. Next, a short setup wizard helps you publish your first product.">
      {token ? <OwnerSetupForm site={site} token={token} /> : <p className="text-sm text-rose-700">This link is missing its token. Open the full link you were sent.</p>}
    </ManageAuthShell>
  );
}
