"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { Types } from "mongoose";
import { formatMoney } from "@/lib/tenant";
import { actorOf, auditLog, refreshStore, staffCtx } from "@/lib/manage-ctx";

type S = { error?: string; ok?: string; link?: string } | undefined;

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "seller";

async function setupLink(m: Awaited<ReturnType<typeof staffCtx>>["m"], userId: Types.ObjectId, base: string) {
  const token = crypto.randomBytes(24).toString("base64url");
  await m.User.updateOne({ _id: userId }, { $set: { setupTokenHash: crypto.createHash("sha256").update(token).digest("hex"), setupTokenExpires: new Date(Date.now() + 7 * 86400_000) } });
  return `${base}/manage/setup?token=${token}`;
}

// ---------- Marketplace sellers (F-67) ----------

export async function createSeller(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "staff");
  if (!store.features["F-67"]) return { error: "The marketplace (F-67) is off." };
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const rate = Number(form.get("rate") ?? store.settings.sellerRate);
  if (name.length < 2) return { error: "Enter the seller's shop name." };
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email for the seller's sign-in." };
  if (!(rate >= 0 && rate <= 90)) return { error: "Commission must be between 0% and 90%." };
  if (await m.User.exists({ email })) return { error: "Someone already uses that email in this store." };
  let slug = slugify(name);
  if (await m.Seller.exists({ slug })) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;
  const seller = await m.Seller.create({ name, slug, email, rate, phone: String(form.get("phone") ?? "").trim().slice(0, 30), about: String(form.get("about") ?? "").trim().slice(0, 2000) });
  const u = await m.User.create({ name, email, role: "seller", sellerId: seller._id });
  const link = await setupLink(m, u._id, store.base);
  await auditLog(store, actorOf(user), "seller.create", name);
  refreshStore(store);
  return { ok: `${name} added. Send them this link to set their password (valid 7 days):`, link };
}

export async function sellerSetupLink(site: string, id: string): Promise<S> {
  const { store, user, m } = await staffCtx(site, "staff");
  if (!Types.ObjectId.isValid(id)) return { error: "Unknown seller." };
  const u = await m.User.findOne({ role: "seller", sellerId: new Types.ObjectId(id) });
  if (!u) return { error: "This seller has no sign-in account." };
  const link = await setupLink(m, u._id, store.base);
  await auditLog(store, actorOf(user), "seller.link", id);
  return { ok: "New sign-in link (valid 7 days):", link };
}

export async function updateSeller(site: string, id: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "staff");
  const rate = Number(form.get("rate"));
  if (!Types.ObjectId.isValid(id) || !(rate >= 0 && rate <= 90)) return { error: "Commission must be between 0% and 90%." };
  await m.Seller.updateOne({ _id: id }, { $set: { rate, phone: String(form.get("phone") ?? "").trim().slice(0, 30), about: String(form.get("about") ?? "").trim().slice(0, 2000) } });
  await auditLog(store, actorOf(user), "seller.update", id, undefined, rate);
  refreshStore(store);
  return { ok: "Saved." };
}

export async function setSellerStatus(site: string, id: string, status: "active" | "paused") {
  const { store, user, m } = await staffCtx(site, "staff");
  if (!Types.ObjectId.isValid(id)) return;
  await m.Seller.updateOne({ _id: id }, { $set: { status } });
  // A paused seller's products leave the store until they're resumed.
  await m.Product.updateMany({ seller: new Types.ObjectId(id) }, { $set: { status: status === "paused" ? "draft" : "active" } });
  await auditLog(store, actorOf(user), `seller.${status}`, id);
  refreshStore(store);
}

export async function recordPayout(site: string, id: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "staff");
  const amount = Math.round(Number(form.get("amount")));
  if (!Types.ObjectId.isValid(id) || !(amount > 0)) return { error: "Enter the amount you paid." };
  await m.Seller.updateOne({ _id: id }, { $push: { payouts: { amount, note: String(form.get("note") ?? "").trim().slice(0, 200), by: user.name, at: new Date() } } });
  await auditLog(store, actorOf(user), "seller.payout", id, undefined, amount);
  refreshStore(store);
  return { ok: `Recorded a payout of ${formatMoney(amount, store.currency)}.` };
}
