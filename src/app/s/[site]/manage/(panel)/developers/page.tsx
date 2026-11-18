import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { storeUrl } from "@/lib/subdomain";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import { Badge, Card } from "@/components/admin/ui";
import { ApiKeyForm, WebhookForm } from "@/components/manage/content-forms";
import { removeWebhook, revokeApiKey, testWebhooks } from "../../manage-actions";

export const metadata = { title: "Developers" };

// F-112: read-only REST API with keys, and signed webhooks.
export default async function Developers({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-112"]) notFound();
  await requireStaff(store, "settings");
  const m = await storeModels(store);
  const [keys, hooks] = await Promise.all([m.ApiKey.find().sort({ createdAt: -1 }).lean(), m.Webhook.find().sort({ createdAt: -1 }).lean()]);
  const api = `${storeUrl(store.subdomain)}/v1`;
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Developers</h1>
      <Card title="🔑 API keys" accent="indigo">
        <p className="mb-3 text-sm text-slate-600">Keys give read-only access to your products and orders. Keep them secret.</p>
        <ApiKeyForm site={site} />
        {keys.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {keys.map((k) => (
              <li key={String(k._id)} className="flex flex-wrap items-center gap-2 py-2">
                <b>{k.name}</b><code className="text-xs text-slate-500">{k.prefix}…</code>
                <span className="text-xs text-slate-500">{k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}` : "never used"}</span>
                <form action={revokeApiKey.bind(null, site, String(k._id))} className="ms-auto"><button className="text-xs text-rose-600 hover:underline">Revoke</button></form>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100">
          <p className="text-slate-400"># List products (add ?page=2, ?limit=50)</p>
          <p>curl -H &quot;Authorization: Bearer sk_…&quot; {api}/products</p>
          <p className="mt-2 text-slate-400"># List orders (?status=pending)</p>
          <p>curl -H &quot;Authorization: Bearer sk_…&quot; {api}/orders</p>
        </div>
      </Card>
      <Card title="🪝 Webhooks" accent="violet" actions={hooks.length > 0 && <form action={testWebhooks.bind(null, site)}><button className="text-xs text-emerald-700 hover:underline">Send a test event</button></form>}>
        <p className="mb-3 text-sm text-slate-600">We POST JSON to your URL when these events happen. Each request has an <code>X-Signature: sha256=…</code> header (HMAC-SHA256 of the body with your secret). This also works with Zapier or Make &quot;catch hook&quot; URLs.</p>
        <WebhookForm site={site} events={WEBHOOK_EVENTS} />
        {hooks.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {hooks.map((h) => (
              <li key={String(h._id)} className="flex flex-wrap items-center gap-2 py-2">
                <code className="break-all text-xs">{h.url}</code>
                {h.events.map((e) => <Badge key={e} tone="slate">{e}</Badge>)}
                {h.lastStatus && <Badge tone={/^2\d\d$/.test(h.lastStatus) ? "green" : "rose"}>{h.lastStatus}</Badge>}
                <form action={removeWebhook.bind(null, site, String(h._id))} className="ms-auto"><button className="text-xs text-rose-600 hover:underline">Remove</button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
