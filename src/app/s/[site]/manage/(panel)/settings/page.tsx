import { requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { domainStatus, domainsConfigured } from "@/lib/vercel-domains";
import { storeUrl } from "@/lib/subdomain";
import { Badge, Card } from "@/components/admin/ui";
import { BrandingForm, DomainForm, SettingsForm } from "@/components/manage/forms";
import { removeCustomDomain } from "../../manage-actions";

export const metadata = { title: "Settings" };

export default async function Settings({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "settings");
  const status = store.customDomain && domainsConfigured() ? await domainStatus(store.customDomain).catch(() => null) : null;
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <Card title="🎨 Branding" accent="violet">
        <BrandingForm site={site} name={store.name} color={store.branding.primaryColor} tagline={store.branding.tagline} logoUrl={store.branding.logoUrl} canColor={!!store.features["F-15"]} />
      </Card>
      <Card title="🏪 Store settings" accent="emerald">
        <SettingsForm site={site} s={{ currency: store.currency, ...store.settings }} f={store.features} />
      </Card>
      <Card title="🌐 Store address" accent="sky">
        <p className="text-sm text-slate-600">Your store is at <a href={storeUrl(store.subdomain)} target="_blank" className="font-medium text-emerald-700 underline">{storeUrl(store.subdomain)}</a>.</p>
        {store.features["F-89"] ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">Custom domain</p>
            {!domainsConfigured() && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">The platform hasn't connected custom domains yet. Ask the platform admin.</p>}
            <DomainForm site={site} current={store.customDomain} />
            {store.customDomain && (
              <div className="rounded-xl border border-slate-200 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <b>{store.customDomain}</b>
                  {status ? <Badge tone={status.verified && !status.misconfigured ? "green" : "amber"}>{status.verified && !status.misconfigured ? "Active with SSL" : "Waiting for DNS"}</Badge> : <Badge>Unknown</Badge>}
                  <form action={removeCustomDomain.bind(null, site)} className="ml-auto"><button className="text-xs text-rose-600 hover:underline">Remove</button></form>
                </div>
                {status && (!status.verified || status.misconfigured) && (
                  <>
                    <p className="mb-2 text-slate-600">Add this record at your domain provider. SSL is issued automatically once it's found:</p>
                    <table className="w-full font-mono text-xs"><thead className="text-left text-slate-500"><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
                      <tbody>{status.records.map((r) => <tr key={r.type + r.name + r.value}><td className="py-1">{r.type}</td><td>{r.name}</td><td className="break-all">{r.value}</td></tr>)}</tbody></table>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Want your own domain like myshop.com? Turn on Custom domain (F-89) if your plan includes it.</p>
        )}
      </Card>
    </>
  );
}
