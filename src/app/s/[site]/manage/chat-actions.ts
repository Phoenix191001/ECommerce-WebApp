"use server";

import { Types } from "mongoose";
import { staffCtx } from "@/lib/manage-ctx";
import { esc, sendEmail } from "@/lib/email";

export type Inbox = {
  threads: { id: string; name: string; email: string; status: "open" | "closed"; unread: boolean; last: string; lastAt: string }[];
  open?: { id: string; name: string; email: string; status: "open" | "closed"; messages: { from: "visitor" | "staff"; name: string; text: string; at: string }[] };
};

/** F-45: chats for the staff inbox, newest first, and the selected one. */
export async function chatInbox(site: string, openId?: string): Promise<Inbox> {
  const { store, m } = await staffCtx(site, "customers");
  if (!store.features["F-45"]) return { threads: [] };
  const list: { _id: unknown; name: string; email: string; status: "open" | "closed"; unread: boolean; lastAt: Date; messages?: { text: string }[] }[] = await m.Chat.find({}, { name: 1, email: 1, status: 1, unread: 1, lastAt: 1, messages: { $slice: -1 } }).sort({ status: -1, lastAt: -1 }).limit(60).lean();
  let open: Inbox["open"];
  if (openId && Types.ObjectId.isValid(openId)) {
    const t = await m.Chat.findByIdAndUpdate(openId, { $set: { unread: false } }, { returnDocument: "after" }).lean();
    if (t) open = { id: String(t._id), name: t.name, email: t.email, status: t.status, messages: t.messages.map((x) => ({ from: x.from, name: x.name, text: x.text, at: new Date(x.at).toISOString() })) };
  }
  return {
    threads: list.map((t) => ({ id: String(t._id), name: t.name || "Visitor", email: t.email, status: t.status, unread: t.unread && String(t._id) !== openId, last: t.messages?.[0]?.text?.slice(0, 80) ?? "", lastAt: new Date(t.lastAt).toISOString() })),
    open,
  };
}

export async function chatReply(site: string, id: string, text: string): Promise<{ error?: string }> {
  const { store, user, m } = await staffCtx(site, "customers");
  const msg = String(text ?? "").trim().slice(0, 1000);
  if (!msg || !Types.ObjectId.isValid(id)) return { error: "Write a reply first." };
  const t = await m.Chat.findById(id);
  if (!t) return { error: "Chat not found." };
  const visitorLast = [...t.messages].reverse().find((x) => x.from === "visitor");
  t.messages.push({ from: "staff", name: user.name.split(" ")[0], text: msg, at: new Date() });
  t.status = "open";
  t.lastAt = new Date();
  await t.save();
  // If the shopper left more than 10 minutes ago and gave an email, send the reply there too.
  if (t.email && store.features["F-41"] && visitorLast && Date.now() - new Date(visitorLast.at).getTime() > 10 * 60_000)
    await sendEmail(m, t.email, `${store.name} replied to your chat`, `<p>${esc(msg).replace(/\n/g, "<br>")}</p><p>— ${esc(user.name)}, ${esc(store.name)}</p>`).catch(() => {});
  return {};
}

export async function chatSetStatus(site: string, id: string, status: "open" | "closed") {
  const { m } = await staffCtx(site, "customers");
  if (Types.ObjectId.isValid(id)) await m.Chat.updateOne({ _id: id }, { $set: { status, unread: false } });
}
