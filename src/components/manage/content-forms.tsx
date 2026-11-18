"use client";

import { useActionState, useState } from "react";
import { addWebhook, createApiKey, savePage, saveStorefrontExtras, type MState, type SecretState } from "@/app/s/[site]/manage/manage-actions";
import { KeepForm } from "@/components/keep-form";
import { Field, FormMessage, btnTealCls, inputCls } from "@/components/admin/ui";

const tealInput = inputCls.replaceAll("indigo", "emerald");

export function PageEditor({ site, page }: { site: string; page?: { id: string; kind: string; title: string; body: string; excerpt: string; published: boolean } }) {
  const [s, a, p] = useActionState<MState, FormData>(savePage.bind(null, site, page?.id ?? null), undefined);
  return (
    <KeepForm action={a} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Type">
          <select name="kind" defaultValue={page?.kind ?? "page"} className={tealInput}><option value="page">Page (About, Policies…)</option><option value="post">Blog post</option></select>
        </Field>
        <Field label="Title"><input name="title" required defaultValue={page?.title} className={tealInput} /></Field>
      </div>
      {!page && <Field label="Address (optional)" hint="e.g. about-us → /pages/about-us"><input name="slug" className={tealInput} /></Field>}
      <Field label="Summary" hint="Shown in the blog list."><input name="excerpt" defaultValue={page?.excerpt} maxLength={300} className={tealInput} /></Field>
      <Field label="Text" hint="Plain text. Blank lines start new paragraphs; lines starting with # become headings and - become bullet points.">
        <textarea name="body" rows={14} defaultValue={page?.body} className={`${tealInput} font-mono text-sm`} />
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" value="1" defaultChecked={page?.published ?? true} /> Published</label>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? "Saving…" : "Save"}</button>
    </KeepForm>
  );
}

export function ExtrasForm({ site, v, f }: { site: string; v: { menu: { label: string; url: string }[]; locations: { name: string; address: string; phone: string; hours: string }[]; gaId: string; pixelId: string; exitOfferCode: string; customCss: string }; f: Record<string, boolean> }) {
  const [s, a, p] = useActionState<MState, FormData>(saveStorefrontExtras.bind(null, site), undefined);
  const off = (id: string) => (f[id] ? undefined : <span className="text-amber-700">Turn on {id} to use this.</span>);
  return (
    <KeepForm action={a} className="space-y-4">
      <Field label="Header menu links" hint={off("F-117") ?? "One per line: Label | /pages/about-us  (or a full https:// link). Up to 8."}>
        <textarea name="menu" rows={3} defaultValue={v.menu.map((m) => `${m.label} | ${m.url}`).join("\n")} className={`${tealInput} font-mono text-xs`} placeholder={"About us | /pages/about-us\nSale | /?tag=sale"} />
      </Field>
      <Field label="Shop locations" hint={off("F-88") ?? "One per line: Name | Address | Phone | Hours"}>
        <textarea name="locations" rows={3} defaultValue={v.locations.map((l) => [l.name, l.address, l.phone, l.hours].join(" | ")).join("\n")} className={`${tealInput} font-mono text-xs`} placeholder="Main branch | 12 Mall Road, Lahore | 042-1234567 | 10am–9pm" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Google Analytics ID" hint={off("F-76") ?? "G-XXXXXXX"}><input name="gaId" defaultValue={v.gaId} className={tealInput} /></Field>
        <Field label="Meta Pixel ID" hint={off("F-76")}><input name="pixelId" defaultValue={v.pixelId} className={tealInput} /></Field>
        <Field label="Exit offer code" hint={off("F-119") ?? "A discount code shown when shoppers try to leave checkout."}><input name="exitOfferCode" defaultValue={v.exitOfferCode} className={`${tealInput} uppercase`} /></Field>
      </div>
      <Field label="Custom CSS" hint={off("F-115") ?? "Advanced: styles added to every storefront page."}>
        <textarea name="customCss" rows={5} defaultValue={v.customCss} className={`${tealInput} font-mono text-xs`} placeholder=".btn-brand { border-radius: 9999px; }" />
      </Field>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? "Saving…" : "Save storefront settings"}</button>
    </KeepForm>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="font-semibold text-amber-900">{label}</p>
      <div className="mt-1 flex gap-2">
        <code className="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs">{value}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))} className="rounded border border-amber-300 bg-white px-2 text-xs">{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

export function ApiKeyForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<SecretState, FormData>(createApiKey.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-2">
      <div className="flex gap-2">
        <input name="name" placeholder="Key name (e.g. Accounting sync)" className={tealInput} aria-label="Key name" />
        <button className={btnTealCls} disabled={p}>Create key</button>
      </div>
      <FormMessage state={s} />
      {s?.key && <Secret label="Your new API key (shown once)" value={s.key} />}
    </KeepForm>
  );
}

export function WebhookForm({ site, events }: { site: string; events: readonly string[] }) {
  const [s, a, p] = useActionState<SecretState, FormData>(addWebhook.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-2">
      <input name="url" type="url" required placeholder="https://example.com/webhooks/store" className={tealInput} aria-label="Webhook URL" />
      <div className="flex flex-wrap gap-3 text-sm">
        {events.map((e) => <label key={e} className="flex items-center gap-1"><input type="checkbox" name="events" value={e} defaultChecked={e === "order.created"} /> <code className="text-xs">{e}</code></label>)}
      </div>
      <FormMessage state={s} />
      {s?.secret && <Secret label="Signing secret (shown once)" value={s.secret} />}
      <button className={btnTealCls} disabled={p}>Add webhook</button>
    </KeepForm>
  );
}
