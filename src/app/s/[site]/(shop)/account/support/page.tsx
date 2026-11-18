import { notFound, redirect } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/store-auth";
import { TicketForm, TicketReply } from "@/components/store/extras";
import { AccountNav } from "../account-nav";
import { storePrefs } from "@/lib/store-prefs";

export const metadata = { title: "Support" };

export default async function Support({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-22"] || !store.features["F-73"]) notFound();
  const user = await getCurrentUser(store);
  if (!user || user.role !== "customer") redirect(`${store.base}/account/login`);
  const { t: L } = await storePrefs(store);
  const tickets = await (await storeModels(store)).Ticket.find({ user: user._id }).sort({ updatedAt: -1 }).lean();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{L.supportTitle}</h1>
      <AccountNav store={store} active="support" L={L} />
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">{L.newRequest}</h2>
        <TicketForm site={site} />
      </section>
      {tickets.map((t) => (
        <section key={String(t._id)} className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{t.subject} <span className="bg-brand-soft ms-2 rounded-full px-2 py-0.5 text-xs font-medium capitalize">{t.status}</span></h2>
          <ol className="mt-3 space-y-2">
            {t.messages.map((msg, i) => (
              <li key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.from === "customer" ? "bg-brand-soft ms-auto" : "bg-slate-100"}`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <p className="mt-1 text-[11px] text-slate-500">{msg.from === "staff" ? `${msg.name} · ${store.name}` : "You"} · {new Date(msg.at).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</p>
              </li>
            ))}
          </ol>
          <TicketReply site={site} id={String(t._id)} />
        </section>
      ))}
    </main>
  );
}
