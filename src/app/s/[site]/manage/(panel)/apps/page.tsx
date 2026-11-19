import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { APPS, activeApps } from "@/lib/apps";
import { Badge, Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { installApp, removeApp, toggleApp } from "../../growth-actions";

export const metadata = { title: "App store" };
const input = inputCls.replaceAll("indigo", "emerald");

export default async function AppStore({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "settings");
  if (!store.features["F-114"]) notFound();
  const installed = new Map(store.settings.apps.map((a) => [a.id, a]));
  const working = new Set(activeApps(store.settings.apps).map((a) => a.id));
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🔌 App store</h1>
        <p className="text-sm text-slate-500">Add extra tools to your store. Apps that show something to shoppers (chat, tracking) load only after the shopper accepts cookies when the cookie banner (F-79) is on.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {APPS.map((a) => {
          const inst = installed.get(a.id);
          return (
            <Card key={a.id} accent={inst ? (inst.enabled ? "emerald" : "amber") : "sky"}
              title={<span className="flex flex-wrap items-center gap-2">{a.icon} {a.name} <Badge tone="slate">{a.category}</Badge>{inst && <Badge tone={working.has(a.id) ? "green" : "amber"}>{inst.enabled ? "on" : "paused"}</Badge>}</span>}
              actions={inst ? (
                <div className="flex gap-3">
                  <form action={toggleApp.bind(null, site, a.id)}><button className="text-xs text-slate-600 hover:underline">{inst.enabled ? "Pause" : "Turn on"}</button></form>
                  <form action={removeApp.bind(null, site, a.id)}><button className="text-xs text-rose-600 hover:underline">Remove</button></form>
                </div>
              ) : undefined}>
              <p className="text-sm text-slate-600">{a.description}</p>
              <p className="mt-1 text-xs text-slate-500">You need: {a.needs}</p>
              <details className="mt-3" open={!inst && a.fields.length === 0 ? false : undefined}>
                <summary className="cursor-pointer text-sm font-semibold text-emerald-700">{inst ? "Settings" : "Install"}</summary>
                <ActionForm action={installApp.bind(null, site, a.id)} submit={inst ? "Save" : "Install"} className="mt-2 space-y-2">
                  {a.fields.map((f) => (
                    <Field key={f.key} label={f.label} hint={f.secret && inst ? "Saved. Leave empty to keep it." : f.hint}>
                      <input name={f.key} defaultValue={f.secret ? "" : inst?.config?.[f.key] ?? ""} placeholder={f.placeholder} type={f.secret ? "password" : "text"} autoComplete="off" className={input} />
                    </Field>
                  ))}
                </ActionForm>
              </details>
            </Card>
          );
        })}
      </div>
    </>
  );
}
