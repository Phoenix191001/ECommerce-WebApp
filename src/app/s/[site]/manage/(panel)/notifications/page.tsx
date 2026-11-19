import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { pushConfigured } from "@/lib/push";
import { Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { sendPushBroadcast } from "../../growth-actions";

export const metadata = { title: "Push notifications" };
const input = inputCls.replaceAll("indigo", "emerald");

export default async function Notifications({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "settings");
  if (!store.features["F-109"]) notFound();
  const m = await storeModels(store);
  const [all, offers] = await Promise.all([m.PushSub.countDocuments(), m.PushSub.countDocuments({ marketing: true })]);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🔔 Push notifications</h1>
        <p className="text-sm text-slate-500">Shoppers can turn on browser notifications on their order page (for order updates) or in the store footer (for offers). Order updates are sent automatically when you confirm, ship or deliver.</p>
      </div>
      {!pushConfigured() && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">⚠️ Push isn&apos;t set up on this platform yet. The platform admin needs to add VAPID keys.</p>}
      <Card title="Subscribers" accent="sky"><p className="text-sm">{all} browser(s) subscribed · {offers} want offers.</p></Card>
      <Card title="📣 Send an offer to everyone who opted in" accent="emerald">
        <ActionForm action={sendPushBroadcast.bind(null, site)} submit="Send notification" pending="Sending…" reset>
          <Field label="Title"><input name="title" maxLength={60} defaultValue={store.name} className={input} /></Field>
          <Field label="Message"><input name="body" maxLength={180} required className={input} placeholder="Weekend sale: 20% off everything!" /></Field>
          <Field label="Open this page when tapped" hint='A path in your store, e.g. "/" or "/p/blue-shirt"'><input name="url" defaultValue="/" className={input} /></Field>
        </ActionForm>
      </Card>
    </>
  );
}
