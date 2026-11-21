"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { Types } from "mongoose";
import { formatMoney } from "@/lib/tenant";
import { actorOf, auditLog, refreshStore, saveStoreSettings, staffCtx } from "@/lib/manage-ctx";
import { issueGiftCard } from "@/lib/giftcards";
import { broadcastPush, pushConfigured } from "@/lib/push";
import { APP_MAP } from "@/lib/apps";
import { alertApps } from "@/lib/app-alerts";
import { LANG_CODES, isLang } from "@/lib/languages";

type S = { error?: string; ok?: string } | undefined;
const off = (id: string, name: string): S => ({ error: `${name} (${id}) is turned off. Turn it on in Features first.` });

// ---------- Gift cards (F-32) ----------

export async function createGiftCard(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "discounts");
  if (!store.features["F-32"]) return off("F-32", "Gift cards");
  const amount = Math.round(Number(form.get("amount")));
  if (!(amount >= 1 && amount <= 10_000_000)) return { error: "Enter the card's value." };
  const recipient = String(form.get("recipient") ?? "").trim().toLowerCase();
  if (recipient && !z.email().safeParse(recipient).success) return { error: "That email doesn't look right." };
  const days = Math.max(0, Math.floor(Number(form.get("days") ?? 0)));
  const code = await issueGiftCard(store, m, {
    amount, recipient, note: String(form.get("note") ?? "").trim().slice(0, 200), by: user.name,
    expiresAt: days ? new Date(Date.now() + days * 86400_000) : undefined,
  });
  await auditLog(store, actorOf(user), "giftcard.create", code, undefined, amount);
  refreshStore(store);
  return { ok: `Gift card ${code} created for ${formatMoney(amount, store.currency)}.${recipient && store.features["F-41"] ? ` Emailed to ${recipient}.` : ""}` };
}

export async function toggleGiftCard(site: string, id: string) {
  const { store, user, m } = await staffCtx(site, "discounts");
  if (!Types.ObjectId.isValid(id)) return;
  const g = await m.GiftCard.findById(id);
  if (!g) return;
  g.active = !g.active;
  await g.save();
  await auditLog(store, actorOf(user), g.active ? "giftcard.enable" : "giftcard.disable", g.code);
  refreshStore(store);
}

export async function adjustGiftCard(site: string, id: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "discounts");
  if (!Types.ObjectId.isValid(id)) return { error: "Unknown card." };
  const amount = Math.round(Number(form.get("amount")));
  if (!amount) return { error: "Enter an amount, e.g. 500 to add or -500 to take off." };
  const r = await m.GiftCard.updateOne(
    { _id: id, ...(amount < 0 ? { balance: { $gte: -amount } } : {}) },
    { $inc: { balance: amount }, $push: { history: { amount, by: user.name, at: new Date() } } },
  );
  if (!r.modifiedCount) return { error: "The card doesn't have that much balance." };
  await auditLog(store, actorOf(user), "giftcard.adjust", id, undefined, amount);
  refreshStore(store);
  return { ok: "Balance updated." };
}

// ---------- Affiliates (F-71) ----------

const affCode = (name: string) => (name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "AFF") + crypto.randomBytes(2).toString("hex").toUpperCase();

export async function createAffiliate(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "discounts");
  if (!store.features["F-71"]) return off("F-71", "Affiliates");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const rate = Number(form.get("rate") ?? store.settings.affiliateRate);
  let code = String(form.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30);
  if (name.length < 2) return { error: "Enter the affiliate's name." };
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email." };
  if (!(rate >= 0 && rate <= 90)) return { error: "Commission must be between 0% and 90%." };
  if (!code) code = affCode(name);
  if (code.length < 3) return { error: "Use at least 3 letters or numbers for the code." };
  if (await m.Affiliate.exists({ code })) return { error: "That code is taken. Choose another." };
  await m.Affiliate.create({ name, email, code, rate, status: "active", statsKey: crypto.randomBytes(12).toString("base64url") });
  await auditLog(store, actorOf(user), "affiliate.create", code);
  refreshStore(store);
  return { ok: `Affiliate ${name} added with code ${code}.` };
}

export async function setAffiliateStatus(site: string, id: string, status: "active" | "paused") {
  const { store, user, m } = await staffCtx(site, "discounts");
  if (!Types.ObjectId.isValid(id)) return;
  await m.Affiliate.updateOne({ _id: id }, { $set: { status } });
  await auditLog(store, actorOf(user), `affiliate.${status}`, id);
  refreshStore(store);
}

export async function setAffiliateRate(site: string, id: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "discounts");
  const rate = Number(form.get("rate"));
  if (!Types.ObjectId.isValid(id) || !(rate >= 0 && rate <= 90)) return { error: "Commission must be between 0% and 90%." };
  await m.Affiliate.updateOne({ _id: id }, { $set: { rate } });
  await auditLog(store, actorOf(user), "affiliate.rate", id, undefined, rate);
  refreshStore(store);
  return { ok: "Saved. The new rate applies to future orders." };
}

/** Mark all delivered, unpaid commissions of one affiliate as paid. */
export async function payAffiliate(site: string, code: string) {
  const { store, user, m } = await staffCtx(site, "discounts");
  const r = await m.Order.updateMany({ affiliate: code, status: "delivered", commissionPaid: false }, { $set: { commissionPaid: true } });
  await auditLog(store, actorOf(user), "affiliate.paid", code, undefined, r.modifiedCount);
  refreshStore(store);
}

// ---------- A/B tests (F-78) ----------

export async function createExperiment(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "settings");
  if (!store.features["F-78"]) return off("F-78", "A/B testing");
  const raw = String(form.get("section"));
  if (raw !== "headline" && raw !== "announcement" && raw !== "hero") return { error: "Choose what to test." };
  const section: "headline" | "announcement" | "hero" = raw;
  const a = String(form.get("a") ?? "").trim().slice(0, 300);
  const b = String(form.get("b") ?? "").trim().slice(0, 300);
  if (!a || !b || a === b) return { error: "Write two different versions to compare." };
  if (section === "hero" && ![a, b].every((x) => /^https:\/\/\S+$/.test(x))) return { error: "For the banner image, paste two image links starting with https://" };
  if (await m.Experiment.exists({ active: true, section })) return { error: "There's already a running test for that section. Stop it first." };
  const name = String(form.get("name") ?? "").trim().slice(0, 80) || `${section} test`;
  await m.Experiment.create({ name, section, a, b });
  await auditLog(store, actorOf(user), "abtest.create", name);
  refreshStore(store);
  return { ok: "Test started. Each visitor sees one version, always the same one." };
}

export async function stopExperiment(site: string, id: string) {
  const { store, user, m } = await staffCtx(site, "settings");
  if (!Types.ObjectId.isValid(id)) return;
  await m.Experiment.updateOne({ _id: id }, { $set: { active: false } });
  await auditLog(store, actorOf(user), "abtest.stop", id);
  refreshStore(store);
}

export async function deleteExperiment(site: string, id: string) {
  const { store, user, m } = await staffCtx(site, "settings");
  if (!Types.ObjectId.isValid(id)) return;
  await m.Experiment.deleteOne({ _id: id, active: false });
  await auditLog(store, actorOf(user), "abtest.delete", id);
  refreshStore(store);
}

// ---------- Web push (F-109) ----------

export async function sendPushBroadcast(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "settings");
  if (!store.features["F-109"]) return off("F-109", "Web push");
  if (!pushConfigured()) return { error: "Push isn't set up on this platform yet (VAPID keys missing). Ask the platform admin." };
  const title = String(form.get("title") ?? "").trim().slice(0, 60) || store.name;
  const body = String(form.get("body") ?? "").trim().slice(0, 180);
  const path = String(form.get("url") ?? "").trim();
  if (body.length < 3) return { error: "Write a short message." };
  const url = /^\/[^\s]*$/.test(path) ? `${store.base}${path === "/" ? "" : path}` || "/" : store.base || "/";
  const sent = await broadcastPush(store, m, { title, body, url });
  await auditLog(store, actorOf(user), "push.broadcast", title, undefined, sent);
  return { ok: sent ? `Sent to ${sent} device(s).` : "Nobody has turned on offer notifications yet." };
}

// ---------- Birthday and anniversary rewards (F-108), affiliate default ----------

export async function saveRewardSettings(site: string, _: S, form: FormData): Promise<S> {
  const { store, user } = await staffCtx(site, "settings");
  const n = (k: string, max: number) => Math.max(0, Math.min(max, Math.floor(Number(form.get(k) ?? 0)) || 0));
  const patch: Record<string, number> = {};
  if (form.has("birthdayPoints")) patch.birthdayPoints = n("birthdayPoints", 100000);
  if (form.has("anniversaryPoints")) patch.anniversaryPoints = n("anniversaryPoints", 100000);
  if (form.has("affiliateRate")) patch.affiliateRate = n("affiliateRate", 90);
  await saveStoreSettings(store, patch);
  await auditLog(store, actorOf(user), "settings.rewards", undefined, undefined, patch);
  refreshStore(store);
  return { ok: "Saved." };
}

// ---------- Multi-currency (F-55) ----------

/** "USD = 0.0036" per line: 1 unit of the store currency is worth this much of the other. */
export async function saveCurrencies(site: string, _: S, form: FormData): Promise<S> {
  const { store, user } = await staffCtx(site, "settings");
  if (!store.features["F-55"]) return off("F-55", "Multi-currency");
  const out: { code: string; rate: number }[] = [];
  for (const line of String(form.get("currencies") ?? "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^([A-Za-z]{3})\s*[=:]\s*([0-9]*\.?[0-9]+)$/);
    if (!m) return { error: `Couldn't read "${line}". Use the form USD = 0.0036` };
    const code = m[1].toUpperCase();
    const rate = Number(m[2]);
    try { new Intl.NumberFormat("en", { style: "currency", currency: code }); } catch { return { error: `${code} isn't a currency code.` }; }
    if (code === store.currency || !(rate > 0)) return { error: `Check the line for ${code}.` };
    if (!out.some((c) => c.code === code)) out.push({ code, rate });
  }
  await saveStoreSettings(store, { currencies: out.slice(0, 10) });
  await auditLog(store, actorOf(user), "settings.currencies", undefined, undefined, out);
  refreshStore(store);
  return { ok: out.length ? `Shoppers can now pick ${out.map((c) => c.code).join(", ")}.` : "Extra currencies removed." };
}

// ---------- Page builder home page (F-116) ----------

export async function setHomePage(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "settings");
  if (!store.features["F-116"]) return off("F-116", "Page builder");
  const slug = String(form.get("homePage") ?? "");
  if (slug && !(await m.Page.exists({ slug, kind: "page" }))) return { error: "Choose one of your pages." };
  await saveStoreSettings(store, { homePage: slug });
  await auditLog(store, actorOf(user), "settings.homepage", undefined, store.settings.homePage, slug);
  refreshStore(store);
  return { ok: slug ? "Your home page now shows that page. Searches still show the product list." : "The home page shows your product list again." };
}

// ---------- App marketplace (F-114) ----------

export async function installApp(site: string, id: string, _: S, form: FormData): Promise<S> {
  const { store, user } = await staffCtx(site, "settings");
  if (!store.features["F-114"]) return off("F-114", "App marketplace");
  const def = APP_MAP[id];
  if (!def) return { error: "Unknown app." };
  const prev = store.settings.apps.find((a) => a.id === id);
  const config: Record<string, string> = {};
  for (const f of def.fields) {
    let v = String(form.get(f.key) ?? "").trim();
    if (!v && f.secret && prev?.config?.[f.key]) v = prev.config[f.key]; // keep a saved secret
    if (!f.pattern.test(v)) return { error: `Check the ${f.label}.${f.placeholder ? ` It looks like ${f.placeholder}` : ""}` };
    config[f.key] = v;
  }
  const apps = [...store.settings.apps.filter((a) => a.id !== id), { id, enabled: true, config }];
  await saveStoreSettings(store, { apps });
  await auditLog(store, actorOf(user), prev ? "app.update" : "app.install", def.name);
  refreshStore(store);
  if (def.category === "Alerts") {
    store.settings.apps = apps;
    await alertApps(store, { number: 0, total: 0, customer: { name: "Test message", city: "" }, items: [{ name: `${def.name} is connected ✅`, qty: 1 }] });
    return { ok: `${def.name} is on. We sent a test message.` };
  }
  return { ok: `${def.name} is on.` };
}

export async function removeApp(site: string, id: string) {
  const { store, user } = await staffCtx(site, "settings");
  await saveStoreSettings(store, { apps: store.settings.apps.filter((a) => a.id !== id) });
  await auditLog(store, actorOf(user), "app.remove", id);
  refreshStore(store);
}

export async function toggleApp(site: string, id: string) {
  const { store, user } = await staffCtx(site, "settings");
  const apps = store.settings.apps.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
  await saveStoreSettings(store, { apps });
  await auditLog(store, actorOf(user), "app.toggle", id);
  refreshStore(store);
}

export async function saveChatGreeting(site: string, _: S, form: FormData): Promise<S> {
  const { store, user } = await staffCtx(site, "customers");
  const chatGreeting = String(form.get("chatGreeting") ?? "").trim().slice(0, 200);
  await saveStoreSettings(store, { chatGreeting });
  await auditLog(store, actorOf(user), "settings.chat", undefined, undefined, chatGreeting);
  return { ok: "Saved." };
}

// ---------- Storefront languages (F-16) ----------

export async function saveLanguages(site: string, _: S, form: FormData): Promise<S> {
  const { store, user } = await staffCtx(site, "settings");
  if (!store.features["F-16"]) return off("F-16", "Multi-language storefront");
  const picked = form.getAll("languages").map(String).filter(isLang);
  const languages = LANG_CODES.filter((c) => c === "en" || picked.includes(c));
  const d = String(form.get("defaultLang") ?? "en");
  const defaultLang = isLang(d) && languages.includes(d) ? d : "en";
  await saveStoreSettings(store, { languages, defaultLang });
  await auditLog(store, actorOf(user), "settings.languages", undefined, store.settings.languages, languages);
  refreshStore(store);
  return { ok: `Shoppers can choose: ${languages.length} language(s).` };
}
