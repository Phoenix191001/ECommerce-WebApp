import { requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { domainStatus, domainsConfigured } from "@/lib/vercel-domains";
import { storeUrl } from "@/lib/subdomain";
import { Badge, Card } from "@/components/admin/ui";
import { BrandingForm, DomainForm, SettingsForm, SubdomainForm } from "@/components/manage/forms";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { rootDomain } from "@/lib/subdomain";
import { removeCustomDomain } from "../../manage-actions";
import { saveCurrencies, saveRewardSettings } from "../../growth-actions";
import { ActionForm } from "@/components/manage/action-form";
import { Field, inputCls } from "@/components/admin/ui";

export const metadata = { title: "Settings" };

export default async function Settings({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const user = await requireStaff(store, "settings");
  const inst = await platformModels(await platformDb()).Instance.findById(store.id, { subdomainChangedAt: 1 }).lean();
  const nextAt = inst?.subdomainChangedAt ? new Date(inst.subdomainChangedAt).getTime() + 30 * 86400_000 : 0;
  const nextChange = nextAt > new Date().getTime() ? new Date(nextAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "long" }) : undefined;
  const status = store.customDomain && domainsConfigured() ? await domainStatus(store.customDomain).catch(() => null) : null;
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <Card title="🎨 Branding" accent="violet">
        <BrandingForm site={site} name={store.name} color={store.branding.primaryColor} tagline={store.branding.tagline} logoUrl={store.branding.logoUrl} canColor={!!store.features["F-15"]} uploadUrl={`${store.base}/manage/upload`} storeId={store.id} />
      </Card>
      <Card title="🏪 Store settings" accent="emerald">
        <SettingsForm site={site} s={{ currency: store.currency, ...store.settings }} f={store.features} />
      </Card>
      {store.features["F-55"] && (
        <Card title="💱 Other currencies" accent="amber">
          <ActionForm action={saveCurrencies.bind(null, site)} submit="Save currencies">
            <Field label={`What 1 ${store.currency} is worth in each currency`} hint="One per line, e.g. USD = 0.0036. Shoppers can switch the price display; orders are still charged in your currency. Update the rates when they change.">
              <textarea name="currencies" rows={3} defaultValue={store.settings.currencies.map((c) => `${c.code} = ${c.rate}`).join("\n")} className={`${inputCls} font-mono text-xs`} placeholder={"USD = 0.0036\nAED = 0.013"} />
            </Field>
          </ActionForm>
        </Card>
      )}
      {store.features["F-108"] && (
        <Card title="🎂 Birthday and anniversary rewards" accent="rose">
          <ActionForm action={saveRewardSettings.bind(null, site)} submit="Save" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Birthday points" hint="Given in the customer's birthday month."><input name="birthdayPoints" type="number" min="0" defaultValue={store.settings.birthdayPoints} className={inputCls} /></Field>
            <Field label="Anniversary points" hint="Given each year in the month they joined."><input name="anniversaryPoints" type="number" min="0" defaultValue={store.settings.anniversaryPoints} className={inputCls} /></Field>
          </ActionForm>
          {!store.features["F-28"] && <p className="mt-2 text-xs text-amber-700">Turn on loyalty points (F-28) so customers can receive these.</p>}
        </Card>
      )}
      <Card title="🌐 Store address" accent="sky">
        <p className="text-sm text-slate-600">Your store is at <a href={storeUrl(store.subdomain)} target="_blank" className="font-medium text-emerald-700 underline">{storeUrl(store.subdomain)}</a>.</p>
        {user.role === "owner" && <div className="mt-3"><SubdomainForm site={site} current={store.subdomain} root={rootDomain()} nextChange={nextChange} /></div>}
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
