import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card, Field, inputCls } from "@/components/admin/ui";
import { ActionForm } from "@/components/manage/action-form";
import { ChatInbox } from "@/components/manage/chat-inbox";
import { chatInbox } from "../../chat-actions";
import { saveChatGreeting } from "../../growth-actions";

export const metadata = { title: "Live chat" };

export default async function Chat({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ id?: string }> }) {
  const { site } = await params;
  const { id } = await searchParams;
  const store = await requireStore(site);
  await requireStaff(store, "customers");
  if (!store.features["F-45"]) notFound();
  const initial = await chatInbox(site, id);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">💬 Live chat</h1>
        <p className="text-sm text-slate-500">Shoppers chat with you from any page of your store. Keep this page open to see new messages. If a shopper has left and gave their email, your reply is emailed to them too.</p>
      </div>
      <ChatInbox site={site} initial={initial} />
      <Card title="Greeting" accent="sky">
        <ActionForm action={saveChatGreeting.bind(null, site)} submit="Save" className="flex flex-wrap items-end gap-3">
          <div className="flex-1"><Field label="First message shoppers see"><input name="chatGreeting" maxLength={200} defaultValue={store.settings.chatGreeting} className={inputCls} /></Field></div>
        </ActionForm>
      </Card>
    </>
  );
}
