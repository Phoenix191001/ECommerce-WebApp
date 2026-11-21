import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card } from "@/components/admin/ui";
import { StaffReplyForm } from "@/components/manage/customer-forms";
import { setTicketStatus } from "../../manage-actions";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Support" };

export default async function Support({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ status?: string }> }) {
  const { site } = await params;
  const { status = "open" } = await searchParams;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  if (!store.features["F-73"]) notFound();
  await requireStaff(store, "customers");
  const filter = status === "open" || status === "closed" ? { status } : {};
  const tickets = await (await storeModels(store)).Ticket.find(filter as { status?: "open" | "closed" }).sort({ updatedAt: -1 }).limit(100).lean();
  const b = `${store.base}/manage/support`;
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{T("Support tickets")}</h1>
      <div className="flex gap-1">
        {["open", "closed", "all"].map((x) => <a key={x} href={`${b}?status=${x}`} className={`rounded-full px-3 py-1.5 text-sm capitalize ${status === x ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>{x}</a>)}
      </div>
      {tickets.length === 0 ? <Card><p className="text-sm text-slate-500">No {status === "all" ? "" : status} tickets.</p></Card> : tickets.map((t) => (
        <Card key={String(t._id)} accent={t.status === "open" ? "amber" : "emerald"}
          title={<span className="flex flex-wrap items-center gap-2">{t.subject} <Badge tone={t.status === "open" ? "amber" : "green"}>{t.status}</Badge>{t.orderNumber && <Badge tone="sky">#{t.orderNumber}</Badge>}</span>}
          actions={<form action={setTicketStatus.bind(null, site, String(t._id), t.status === "open" ? "closed" : "open")}><button className="text-xs text-slate-500 hover:underline">{t.status === "open" ? T("Close") : T("Reopen")}</button></form>}>
          <p className="mb-2 text-xs text-slate-500">{t.customerName} · {t.email}</p>
          <ol className="space-y-2">
            {t.messages.map((msg, i) => (
              <li key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.from === "staff" ? "ms-auto bg-emerald-50" : "bg-slate-100"}`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <p className="mt-1 text-[11px] text-slate-500">{msg.name} · {new Date(msg.at).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</p>
              </li>
            ))}
          </ol>
          <StaffReplyForm site={site} id={String(t._id)} />
        </Card>
      ))}
    </>
  );
}
