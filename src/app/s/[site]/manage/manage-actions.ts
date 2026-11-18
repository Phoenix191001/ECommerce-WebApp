"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { getStore, storeModels, formatMoney, type StoreContext } from "@/lib/tenant";
import { createStoreSession, destroyStoreSession, requireStaff, type Permission } from "@/lib/store-auth";
import { loginAs } from "@/lib/store-login";
import { applyStarterPack, applyToggle, type ToggleResult } from "@/lib/toggles";
import { esc, sendEmail } from "@/lib/email";
import { addProjectDomain, domainsConfigured, removeProjectDomain } from "@/lib/vercel-domains";
import type { OrderStatus } from "@/lib/models/tenant";

export type MState = { error?: string; ok?: string } | undefined;

async function ctx(site: string, perm?: Permission) {
  const store = await getStore(site);
  if (!store) throw new Error("Store not found");
  const user = await requireStaff(store, perm);
  const m = await storeModels(store);
  return { store, user, m };
}

const actorEmail = (u: { email: string; imp?: string }) => (u.imp ? `${u.imp} (as ${u.email})` : u.email);

async function audit(store: StoreContext, actor: string, action: string, target?: string, oldValue?: unknown, newValue?: unknown) {
  const { AuditLog } = platformModels(await platformDb());
  await AuditLog.create({ instance: new Types.ObjectId(store.id), actor, actorRole: "store_owner", action, target, oldValue, newValue });
}

const refresh = (store: StoreContext) => revalidatePath(`/s/${store.subdomain}`, "layout");

// ---------- Sign in and setup ----------

export async function staffLogin(site: string, _: MState, form: FormData): Promise<MState> {
  const store = await getStore(site);
  if (!store) return { error: "Store not found." };
  const res = await loginAs(store, form, ["owner", "manager", "cashier"], `${store.base}/manage`);
  return res;
}

/** FR-S-03 style one-time link: the owner sets their password. */
export async function ownerSetup(site: string, token: string, _: MState, form: FormData): Promise<MState> {
  const store = await getStore(site);
  if (!store) return { error: "Store not found." };
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters for your password." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const m = await storeModels(store);
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const owner = await m.User.findOne({ role: "owner", setupTokenHash: hash, setupTokenExpires: { $gt: new Date() } });
  if (!owner) return { error: "This setup link has expired or was already used. Ask the platform admin for a new one." };
  owner.passwordHash = await bcrypt.hash(password, 12);
  owner.setupTokenHash = undefined;
  owner.setupTokenExpires = undefined;
  await owner.save();
  await createStoreSession(store, String(owner._id), "owner");
  redirect(`${store.base}/manage/welcome`);
}

export async function staffLogout(site: string) {
  const store = await getStore(site);
  if (!store) return;
  await destroyStoreSession(store);
  redirect(`${store.base}/manage/login`);
}

// ---------- Onboarding (UX-01) ----------

export async function markOnboarding(site: string, step: string) {
  const { store } = await ctx(site, "settings");
  const { Instance } = platformModels(await platformDb());
  await Instance.updateOne({ _id: store.id }, step === "dismiss" ? { $set: { "onboarding.dismissed": true } } : { $addToSet: { "onboarding.done": step } });
  revalidatePath(`/s/${store.subdomain}/manage`, "layout");
}

// ---------- Products ----------

const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(200),
  price: z.coerce.number().min(0, "Price can't be negative."),
  compareAtPrice: z.union([z.literal(""), z.coerce.number().min(0)]).optional(),
  stock: z.coerce.number().int("Stock must be a whole number.").min(0).default(0),
  category: z.string().trim().max(80).optional().default(""),
  brand: z.string().trim().max(80).optional().default(""),
  sku: z.string().trim().max(80).optional().default(""),
  barcode: z.string().trim().max(80).optional().default(""),
  images: z.string().optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
  status: z.enum(["active", "draft"]).default("active"),
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "product";

export async function saveProduct(site: string, id: string | null, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "catalog");
  if (!store.features["F-01"]) return { error: "Turn on the product catalog (F-01) first." };
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const images = d.images
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\/\S+$/i.test(s))
    .slice(0, 12);
  const doc = {
    name: d.name, price: d.price, stock: d.stock, category: d.category, brand: d.brand, sku: d.sku,
    barcode: d.barcode, description: d.description, status: d.status, images,
    compareAtPrice: d.compareAtPrice === "" || d.compareAtPrice === undefined ? undefined : d.compareAtPrice,
  };
  if (id) {
    if (!Types.ObjectId.isValid(id)) return { error: "Unknown product." };
    await m.Product.updateOne({ _id: id }, { $set: doc, ...(doc.compareAtPrice === undefined ? { $unset: { compareAtPrice: 1 } } : {}) });
    await audit(store, actorEmail(user), "product.update", d.name);
  } else {
    const { Instance, Plan } = platformModels(await platformDb());
    const inst = await Instance.findById(store.id).lean();
    const plan = inst ? await Plan.findById(inst.plan).lean() : null;
    const max = inst?.limitOverrides?.maxProducts ?? plan?.maxProducts ?? 0;
    if (max > 0 && (await m.Product.countDocuments()) >= max)
      return { error: `Your plan allows ${max} products. Upgrade your plan to add more.` };
    let slug = slugify(d.name);
    if (await m.Product.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
    await m.Product.create({ ...doc, slug });
    await audit(store, actorEmail(user), "product.create", d.name);
    if (!store.onboarding.done.includes("product")) await markOnboarding(site, "product").catch(() => {});
  }
  refresh(store);
  if (!id) redirect(`${store.base}/manage/products?saved=1`);
  return { ok: "Saved." };
}

export async function deleteProduct(site: string, id: string) {
  const { store, user, m } = await ctx(site, "catalog");
  if (!Types.ObjectId.isValid(id)) return;
  const p = await m.Product.findByIdAndDelete(id).lean();
  if (p) await audit(store, actorEmail(user), "product.delete", p.name);
  refresh(store);
  redirect(`${store.base}/manage/products`);
}

// ---------- Orders ----------

const NEXT_STATUS: Record<string, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export async function setOrderStatus(site: string, number: number, status: OrderStatus) {
  const { store, user, m } = await ctx(site, "orders");
  const o = await m.Order.findOne({ number });
  if (!o || !NEXT_STATUS[o.status]?.includes(status)) return;
  const old = o.status;
  o.status = status;
  o.history.push({ status, at: new Date(), by: user.name });
  if (status === "delivered" && o.paymentMethod === "cod") o.paymentStatus = "paid";
  // Cancelled orders give their stock back.
  if (status === "cancelled" && store.features["F-17"])
    for (const it of o.items) await m.Product.updateOne({ _id: it.product }, { $inc: { stock: it.qty } });
  await o.save();
  await audit(store, actorEmail(user), "order.status", `#${number}`, old, status);
  if (store.features["F-41"] && o.customer.email) {
    const label = { confirmed: "is confirmed", shipped: "is on the way", delivered: "was delivered", cancelled: "was cancelled" }[status as string] ?? `is ${status}`;
    await sendEmail(m, o.customer.email, `${store.name}: order #${number} ${label}`, `<p>Hi ${esc(o.customer.name)},</p><p>Your order #${number} ${label}.</p>`);
  }
  refresh(store);
}

/** Refund from the panel (owner/manager). POS refunds with limits live in the POS actions. */
export async function refundOrder(site: string, number: number, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "orders");
  const o = await m.Order.findOne({ number });
  if (!o) return { error: "Order not found." };
  const refunded = o.refunds.reduce((n, r) => n + r.amount, 0);
  const amount = Math.round(Number(form.get("amount") ?? 0));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  if (!(amount > 0)) return { error: "Enter an amount above zero." };
  if (amount > o.total - refunded) return { error: `You can refund at most ${formatMoney(o.total - refunded, store.currency)}.` };
  o.refunds.push({ amount, reason, by: user.name, at: new Date() });
  const full = refunded + amount >= o.total;
  o.paymentStatus = full ? "refunded" : "partially_refunded";
  if (full) {
    o.status = "refunded";
    o.history.push({ status: "refunded", at: new Date(), by: user.name, note: reason });
  }
  await o.save();
  await audit(store, actorEmail(user), "order.refund", `#${number}`, undefined, amount);
  refresh(store);
  return { ok: `Refunded ${formatMoney(amount, store.currency)}.` };
}

// ---------- Discounts (F-27) ----------

const discountSchema = z.object({
  code: z.string().trim().min(3, "Codes need at least 3 characters.").max(30).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _ only."),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive("Enter a value above zero."),
  minSubtotal: z.coerce.number().min(0).default(0),
  usageLimit: z.coerce.number().int().min(0).default(0),
  expiresAt: z.string().optional(),
});

export async function saveDiscount(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "discounts");
  if (!store.features["F-27"]) return { error: "Turn on Discount codes (F-27) in Features first." };
  const parsed = discountSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.type === "percent" && d.value > 100) return { error: "A percentage can't be more than 100." };
  const code = d.code.toUpperCase();
  if (await m.Discount.exists({ code })) return { error: `${code} already exists.` };
  await m.Discount.create({ ...d, code, expiresAt: d.expiresAt ? new Date(d.expiresAt) : undefined });
  await audit(store, actorEmail(user), "discount.create", code);
  refresh(store);
  return { ok: `Created ${code}.` };
}

export async function toggleDiscount(site: string, id: string) {
  const { store, m } = await ctx(site, "discounts");
  const d = await m.Discount.findById(id);
  if (!d) return;
  d.active = !d.active;
  await d.save();
  refresh(store);
}

export async function deleteDiscount(site: string, id: string) {
  const { store, user, m } = await ctx(site, "discounts");
  const d = await m.Discount.findByIdAndDelete(id).lean();
  if (d) await audit(store, actorEmail(user), "discount.delete", d.code);
  refresh(store);
}

// ---------- Staff (F-48) ----------

const staffSchema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's name."),
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Temporary password needs at least 8 characters."),
  role: z.enum(["manager", "cashier"]),
  refundLimit: z.coerce.number().min(0).default(0),
  pin: z.string().optional().default(""),
});

export async function addStaff(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "staff");
  if (!store.features["F-48"]) return { error: "Turn on Staff roles (F-48) in Features first." };
  const parsed = staffSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (user.role === "manager" && d.role !== "cashier") return { error: "Managers can add cashiers only." };
  if (d.role === "manager" && d.pin && !/^\d{4,6}$/.test(d.pin)) return { error: "The manager PIN must be 4 to 6 digits." };
  const { Instance, Plan } = platformModels(await platformDb());
  const inst = await Instance.findById(store.id).lean();
  const plan = inst ? await Plan.findById(inst.plan).lean() : null;
  const max = inst?.limitOverrides?.maxStaff ?? plan?.maxStaff ?? 0;
  if (max > 0 && (await m.User.countDocuments({ role: { $in: ["manager", "cashier"] } })) >= max)
    return { error: `Your plan allows ${max} staff accounts.` };
  if (await m.User.exists({ email: d.email.toLowerCase() })) return { error: "Someone with that email already has an account here." };
  await m.User.create({
    name: d.name, email: d.email, role: d.role, refundLimit: d.refundLimit,
    passwordHash: await bcrypt.hash(d.password, 12),
    pinHash: d.role === "manager" && d.pin ? await bcrypt.hash(d.pin, 10) : undefined,
  });
  await audit(store, actorEmail(user), "staff.add", d.email, undefined, d.role);
  refresh(store);
  return { ok: `Added ${d.name}. Share the store's staff sign-in page and their temporary password with them.` };
}

export async function updateStaff(site: string, id: string, form: FormData) {
  const { store, user, m } = await ctx(site, "staff");
  const s = await m.User.findOne({ _id: id, role: { $in: ["manager", "cashier"] } });
  if (!s || (user.role === "manager" && s.role !== "cashier")) return;
  s.refundLimit = Math.max(0, Number(form.get("refundLimit") ?? s.refundLimit) || 0);
  const pin = String(form.get("pin") ?? "");
  if (s.role === "manager" && /^\d{4,6}$/.test(pin)) s.pinHash = await bcrypt.hash(pin, 10);
  await s.save();
  await audit(store, actorEmail(user), "staff.update", s.email, undefined, { refundLimit: s.refundLimit });
  refresh(store);
}

export async function removeStaff(site: string, id: string) {
  const { store, user, m } = await ctx(site, "staff");
  const s = await m.User.findOne({ _id: id, role: { $in: ["manager", "cashier"] } });
  if (!s || (user.role === "manager" && s.role !== "cashier")) return;
  await s.deleteOne();
  await audit(store, actorEmail(user), "staff.remove", s.email);
  refresh(store);
}

// ---------- Features (owner, within plan; FR-A-02) ----------

export async function ownerToggle(site: string, id: string, on: boolean, withPrereqs = false): Promise<ToggleResult> {
  const { store, user } = await ctx(site, "features");
  const res = await applyToggle(store.id, id, on, { email: actorEmail(user), role: "store_owner" }, withPrereqs);
  refresh(store);
  return res;
}

export async function ownerStarterPack(site: string) {
  const { store, user } = await ctx(site, "features");
  await applyStarterPack(store.id, { email: actorEmail(user), role: "store_owner" });
  await markOnboarding(site, "features");
  refresh(store);
}

// ---------- Settings ----------

const hex = /^#[0-9a-fA-F]{6}$/;

export async function saveBranding(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user } = await ctx(site, "settings");
  const name = String(form.get("name") ?? "").trim();
  const color = String(form.get("primaryColor") ?? "");
  const logoUrl = String(form.get("logoUrl") ?? "").trim();
  if (name.length < 2) return { error: "The store name needs at least 2 characters." };
  if (!hex.test(color)) return { error: "Pick a brand color." };
  if (logoUrl && !/^https?:\/\/\S+$/i.test(logoUrl)) return { error: "The logo must be a full image URL starting with https://." };
  if (!store.features["F-15"] && color !== store.branding.primaryColor)
    return { error: "Turn on Storefront theme switching (F-15) to change colors." };
  const { Instance } = platformModels(await platformDb());
  const update = {
    name,
    "branding.primaryColor": color,
    "branding.tagline": String(form.get("tagline") ?? "").trim().slice(0, 160),
    "branding.logoUrl": logoUrl || undefined,
  };
  await Instance.updateOne({ _id: store.id }, { $set: update, $addToSet: { "onboarding.done": "brand" } });
  await audit(store, actorEmail(user), "settings.branding", undefined, { name: store.name, color: store.branding.primaryColor }, { name, color });
  refresh(store);
  return { ok: "Branding saved." };
}

const settingsSchema = z.object({
  currency: z.enum(["PKR", "USD", "AED", "GBP", "EUR", "SAR"]).default("PKR"),
  shippingFlat: z.coerce.number().min(0).default(0),
  freeShippingThreshold: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  whatsapp: z.string().trim().max(20).optional().default(""),
  announcement: z.string().trim().max(160).optional().default(""),
  pickupAddress: z.string().trim().max(200).optional().default(""),
  contactEmail: z.union([z.literal(""), z.email("Enter a valid contact email.")]).default(""),
  seoTitle: z.string().trim().max(70).optional().default(""),
  seoDescription: z.string().trim().max(160).optional().default(""),
  lowStockAt: z.coerce.number().int().min(0).default(5),
});

export async function saveSettings(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user } = await ctx(site, "settings");
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { currency, ...settings } = parsed.data;
  const { Instance } = platformModels(await platformDb());
  await Instance.updateOne(
    { _id: store.id },
    { $set: { currency, ...Object.fromEntries(Object.entries(settings).map(([k, v]) => [`settings.${k}`, v])) }, $addToSet: { "onboarding.done": "shipping" } },
  );
  await audit(store, actorEmail(user), "settings.store", undefined, store.settings, settings);
  refresh(store);
  return { ok: "Settings saved." };
}

// ---------- Custom domain (F-89, FR-U-05) ----------

export async function setCustomDomain(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user } = await ctx(site, "settings");
  if (!store.features["F-89"]) return { error: "Custom domains (F-89) aren't on for this store." };
  if (!domainsConfigured()) return { error: "The platform hasn't connected its Vercel account for domains yet. Ask the platform admin." };
  const domain = String(form.get("domain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) return { error: "Enter a domain like shop.example.com." };
  if (domain.endsWith(".vercel.app") || domain.endsWith(process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "@@"))
    return { error: "Use a domain you own, not a platform address." };
  const { Instance, Plan } = platformModels(await platformDb());
  const inst = await Instance.findById(store.id).lean();
  const plan = inst ? await Plan.findById(inst.plan).lean() : null;
  if ((inst?.limitOverrides?.maxDomains ?? plan?.maxDomains ?? 0) < 1) return { error: "Your plan doesn't include custom domains." };
  if (await Instance.exists({ customDomain: domain, _id: { $ne: store.id } })) return { error: "That domain is used by another store." };
  const res = await addProjectDomain(domain);
  if (res.error) return { error: res.error };
  if (store.customDomain && store.customDomain !== domain) await removeProjectDomain(store.customDomain).catch(() => {});
  await Instance.updateOne({ _id: store.id }, { $set: { customDomain: domain } });
  await audit(store, actorEmail(user), "domain.set", domain, store.customDomain, domain);
  refresh(store);
  return { ok: "Domain added. Set the DNS record below, then the certificate is issued automatically." };
}

export async function removeCustomDomain(site: string) {
  const { store, user } = await ctx(site, "settings");
  if (!store.customDomain) return;
  if (domainsConfigured()) await removeProjectDomain(store.customDomain).catch(() => {});
  const { Instance } = platformModels(await platformDb());
  await Instance.updateOne({ _id: store.id }, { $unset: { customDomain: 1 } });
  await audit(store, actorEmail(user), "domain.remove", store.customDomain);
  refresh(store);
}
