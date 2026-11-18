"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { getStore, priceOrder, storeModels, formatMoney, type StoreContext } from "@/lib/tenant";
import { createStoreSession, destroyStoreSession, requireStaff, type Permission } from "@/lib/store-auth";
import { loginAs } from "@/lib/store-login";
import { storeUrl, validateSubdomain } from "@/lib/subdomain";
import { cookies, headers } from "next/headers";
import { applyStarterPack, applyToggle, type ToggleResult } from "@/lib/toggles";
import { esc, sendEmail } from "@/lib/email";
import { addProjectDomain, domainsConfigured, removeProjectDomain } from "@/lib/vercel-domains";
import type { OrderStatus } from "@/lib/models/tenant";
import { linesOf, releaseStock, reserveStock } from "@/lib/stock";
import { sendBackInStock } from "@/lib/stock-alerts";
import { WEBHOOK_EVENTS, fireWebhook, isSafeWebhookUrl } from "@/lib/webhooks";
import { rewardDelivered } from "@/lib/rewards";
import { parseCsv } from "@/lib/csv";

export type MState = { error?: string; ok?: string } | undefined;
export type SecretState = { error?: string; ok?: string; key?: string; secret?: string } | undefined;

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

export async function setPanelLanguage(site: string, lang: "en" | "ur") {
  const store = await getStore(site);
  if (!store) return;
  (await cookies()).set(`plang_${store.id}`, lang === "ur" ? "ur" : "en", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath(`${store.base}/manage`, "layout");
}

// ---------- Onboarding (UX-01) ----------

export async function markOnboarding(site: string, step: string) {
  const { store } = await ctx(site, "settings");
  const { Instance } = platformModels(await platformDb());
  await Instance.updateOne({ _id: store.id }, step === "dismiss" ? { $set: { "onboarding.dismissed": true } } : { $addToSet: { "onboarding.done": step } });
  revalidatePath(`/s/${store.subdomain}/manage`, "layout");
}

// ---------- Products ----------

const optNum = z.union([z.literal(""), z.coerce.number().min(0)]).optional();
const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(200),
  price: z.coerce.number().min(0, "Price can't be negative."),
  compareAtPrice: optNum,
  stock: z.coerce.number().int("Stock must be a whole number.").min(0).default(0),
  category: z.string().trim().max(80).optional().default(""),
  brand: z.string().trim().max(80).optional().default(""),
  sku: z.string().trim().max(80).optional().default(""),
  barcode: z.string().trim().max(80).optional().default(""),
  images: z.string().optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
  status: z.enum(["active", "draft"]).default("active"),
  optionNames: z.string().trim().max(100).optional().default(""),
  variants: z.string().max(10000).optional().default(""),
  tags: z.string().max(500).optional().default(""),
  publishAt: z.string().optional().default(""),
  warrantyMonths: z.coerce.number().int().min(0).max(240).default(0),
  sizeGuide: z.string().max(5000).optional().default(""),
  volumeTiers: z.string().max(1000).optional().default(""),
  salePrice: optNum,
  saleEndsAt: z.string().optional().default(""),
  costPrice: z.coerce.number().min(0).default(0),
  wholesalePrice: optNum,
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "product";

/** "Red / M | 1500 | 10 | SKU | barcode" per line; price may be empty to use the product price. */
function parseVariants(text: string, existing: { _id: Types.ObjectId; name: string }[]) {
  const out: { _id: Types.ObjectId; name: string; price?: number; stock: number; sku: string; barcode: string }[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [name, price, stock, sku, barcode] = line.split("|").map((x) => x.trim());
    if (!name) continue;
    if (out.some((v) => v.name.toLowerCase() === name.toLowerCase())) return { error: `The variant "${name}" is listed twice.` };
    const pr = price ? Number(price) : undefined;
    const st = stock ? Number(stock) : 0;
    if ((pr !== undefined && !(pr >= 0)) || !(Number.isInteger(st) && st >= 0)) return { error: `Check the price and stock for "${name}".` };
    // Keep the same id for a variant with the same name, so carts and orders still point at it.
    const keep = existing.find((v) => v.name.toLowerCase() === name.toLowerCase());
    out.push({ _id: keep?._id ?? new Types.ObjectId(), name: name.slice(0, 80), price: pr, stock: st, sku: (sku ?? "").slice(0, 80), barcode: (barcode ?? "").slice(0, 80) });
  }
  return { variants: out.slice(0, 100) };
}

function parseTiers(text: string) {
  const tiers: { minQty: number; price: number }[] = [];
  for (const line of text.split(/[\n,]/).map((l) => l.trim()).filter(Boolean)) {
    const mt = line.match(/^(\d+)\s*(?:\+|=|:)?\s*=?\s*(\d+(?:\.\d+)?)$/);
    if (!mt || Number(mt[1]) < 2) return { error: `Write volume prices like "10 = 900" (buy 10 or more, pay 900 each). Problem: "${line}".` };
    tiers.push({ minQty: Number(mt[1]), price: Number(mt[2]) });
  }
  return { tiers: tiers.sort((a, b) => a.minQty - b.minQty).slice(0, 10) };
}

const num = (v: number | "" | undefined) => (v === "" || v === undefined ? undefined : v);
const date = (v: string) => (v ? new Date(v) : undefined);

export async function saveProduct(site: string, id: string | null, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "catalog");
  if (!store.features["F-01"]) return { error: "Turn on the product catalog (F-01) first." };
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (id && !Types.ObjectId.isValid(id)) return { error: "Unknown product." };
  const before = id ? await m.Product.findById(id).lean() : null;
  if (id && !before) return { error: "Product not found." };
  const images = d.images.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\/\S+$/i.test(s)).slice(0, 12);
  const pv = parseVariants(d.variants, (before?.variants ?? []) as { _id: Types.ObjectId; name: string }[]);
  if (pv.error) return { error: pv.error };
  const pt = parseTiers(d.volumeTiers);
  if (pt.error) return { error: pt.error };
  if (num(d.salePrice) !== undefined && !d.saleEndsAt) return { error: "A flash sale needs an end date and time." };
  const doc = {
    name: d.name, price: d.price, stock: d.stock, category: d.category, brand: d.brand, sku: d.sku,
    barcode: d.barcode, description: d.description, status: d.status, images,
    compareAtPrice: num(d.compareAtPrice),
    optionNames: d.optionNames.split("/").map((x) => x.trim()).filter(Boolean).slice(0, 3),
    variants: pv.variants!,
    tags: [...new Set(d.tags.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
    publishAt: date(d.publishAt),
    warrantyMonths: d.warrantyMonths,
    sizeGuide: d.sizeGuide.trim(),
    volumeTiers: pt.tiers!,
    salePrice: num(d.salePrice),
    saleEndsAt: num(d.salePrice) !== undefined ? date(d.saleEndsAt) : undefined,
    costPrice: d.costPrice,
    wholesalePrice: num(d.wholesalePrice),
  };
  const unset = Object.fromEntries(Object.entries(doc).filter(([, v]) => v === undefined).map(([k]) => [k, 1]));
  const set = Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== undefined));
  let productId = id;
  if (id) {
    await m.Product.updateOne({ _id: id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
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
    const created = await m.Product.create({ ...set, slug });
    productId = String(created._id);
    await audit(store, actorEmail(user), "product.create", d.name);
    if (!store.onboarding.done.includes("product")) await markOnboarding(site, "product").catch(() => {});
  }
  const alerted = productId ? await sendBackInStock(store, m, productId) : 0;
  await fireWebhook(store, "product.updated", { id: productId, name: d.name, price: d.price }).catch(() => {});
  refresh(store);
  if (!id) redirect(`${store.base}/manage/products?saved=1`);
  return { ok: alerted ? `Saved. Emailed ${alerted} shopper(s) waiting for it to be back in stock.` : "Saved." };
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
  if (status === "cancelled" && store.features["F-17"]) await releaseStock(m, linesOf(o.items));
  // Cancelled orders give back loyalty points and store credit the customer used.
  if (status === "cancelled" && o.user && (o.pointsRedeemed || o.creditUsed)) {
    await m.User.updateOne(
      { _id: o.user },
      {
        $inc: { loyaltyPoints: o.pointsRedeemed, storeCredit: o.creditUsed },
        ...(o.creditUsed ? { $push: { creditHistory: { amount: o.creditUsed, reason: `Order #${number} cancelled`, at: new Date() } } } : {}),
      },
    );
  }
  await o.save();
  if (status === "delivered") await rewardDelivered(store, m, number);
  await fireWebhook(store, "order.status_changed", { number, from: old, to: status }).catch(() => {});
  await audit(store, actorEmail(user), "order.status", `#${number}`, old, status);
  if (store.features["F-41"] && o.customer.email) {
    const label = { confirmed: "is confirmed", shipped: "is on the way", delivered: "was delivered", cancelled: "was cancelled" }[status as string] ?? `is ${status}`;
    await sendEmail(m, o.customer.email, `${store.name}: order #${number} ${label}`, `<p>Hi ${esc(o.customer.name)},</p><p>Your order #${number} ${label}.</p>`);
  }
  refresh(store);
}

/** Refund from the panel (owner/manager). POS refunds with limits live in the POS actions. */
async function applyRefund(store: StoreContext, m: Awaited<ReturnType<typeof storeModels>>, number: number, amount: number, reason: string, by: string, approvedBy?: string) {
  const o = await m.Order.findOne({ number });
  if (!o) return;
  const refunded = o.refunds.reduce((n, r) => n + r.amount, 0);
  const amt = Math.min(amount, o.total - refunded);
  if (amt <= 0) return;
  o.refunds.push({ amount: amt, reason, by, approvedBy, at: new Date() });
  const full = refunded + amt >= o.total;
  o.paymentStatus = full ? "refunded" : "partially_refunded";
  if (full) {
    o.status = "refunded";
    o.history.push({ status: "refunded", at: new Date(), by, note: reason });
  }
  await o.save();
  await fireWebhook(store, "order.refunded", { number, amount: amt }).catch(() => {});
}

/** Refund from the panel (owner/manager). Large refunds need a second person (F-105). */
export async function refundOrder(site: string, number: number, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "orders");
  const o = await m.Order.findOne({ number });
  if (!o) return { error: "Order not found." };
  const refunded = o.refunds.reduce((n, r) => n + r.amount, 0);
  const pending = o.pendingRefunds.reduce((n, r) => n + r.amount, 0);
  const amount = Math.round(Number(form.get("amount") ?? 0));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  if (!(amount > 0)) return { error: "Enter an amount above zero." };
  if (amount > o.total - refunded - pending) return { error: `You can refund at most ${formatMoney(o.total - refunded - pending, store.currency)}.` };
  if (store.features["F-105"] && amount > store.settings.refundApprovalAbove) {
    o.pendingRefunds.push({ amount, reason, requestedBy: user.name, at: new Date() });
    await o.save();
    await audit(store, actorEmail(user), "order.refund_requested", `#${number}`, undefined, amount);
    refresh(store);
    return { ok: `This refund is above ${formatMoney(store.settings.refundApprovalAbove, store.currency)}, so it needs approval from another owner or manager.` };
  }
  await applyRefund(store, m, number, amount, reason, user.name);
  await audit(store, actorEmail(user), "order.refund", `#${number}`, undefined, amount);
  refresh(store);
  return { ok: `Refunded ${formatMoney(amount, store.currency)}.` };
}

/** F-105: a different owner/manager approves or rejects a pending refund. */
export async function decidePendingRefund(site: string, number: number, refundId: string, approve: boolean) {
  const { store, user, m } = await ctx(site, "orders");
  if (user.role === "cashier" || !Types.ObjectId.isValid(refundId)) return;
  const o = await m.Order.findOne({ number });
  const pr = o?.pendingRefunds.find((x) => String(x._id) === refundId);
  if (!o || !pr) return;
  if (approve && pr.requestedBy === user.name && !user.imp) return; // second person required
  o.pendingRefunds = o.pendingRefunds.filter((x) => String(x._id) !== refundId);
  await o.save();
  if (approve) await applyRefund(store, m, number, pr.amount, pr.reason, pr.requestedBy, user.name);
  await audit(store, actorEmail(user), approve ? "order.refund_approved" : "order.refund_rejected", `#${number}`, undefined, pr.amount);
  refresh(store);
}

// ---------- Order editing (F-98) ----------

export async function editOrder(site: string, number: number, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "orders");
  if (!store.features["F-98"]) return { error: "Order editing (F-98) is off." };
  const o = await m.Order.findOne({ number });
  if (!o) return { error: "Order not found." };
  if (!["pending", "confirmed"].includes(o.status) || o.channel !== "online") return { error: "Only pending or confirmed online orders can be edited." };
  const next = o.items.map((it, i) => ({ it, qty: Math.max(0, Math.min(999, Math.floor(Number(form.get(`qty_${i}`) ?? it.qty)))) }));
  if (!next.some((x) => x.qty > 0)) return { error: "An order needs at least one item. Cancel it instead." };
  const more = next.filter((x) => x.qty > x.it.qty).map((x) => ({ product: String(x.it.product), variant: x.it.variant ? String(x.it.variant) : undefined, qty: x.qty - x.it.qty, name: x.it.name }));
  const less = next.filter((x) => x.qty < x.it.qty).map((x) => ({ product: String(x.it.product), variant: x.it.variant ? String(x.it.variant) : undefined, qty: x.it.qty - x.qty, name: x.it.name }));
  if (!more.length && !less.length) return { ok: "No changes." };
  if (store.features["F-17"]) {
    const r = await reserveStock(m, more);
    if (r.short) return { error: `Not enough stock of ${r.short}.` };
    await releaseStock(m, less);
  }
  const before = o.total;
  o.items = next.filter((x) => x.qty > 0).map((x) => Object.assign(x.it, { qty: x.qty }));
  const subtotal = o.items.reduce((n, i) => n + i.price * i.qty, 0);
  const priced = priceOrder(store, subtotal, Math.min(o.discount, subtotal), o.delivery);
  Object.assign(o, { subtotal: priced.subtotal, discount: priced.discount, shipping: priced.shipping, tax: priced.tax });
  o.total = Math.max(0, priced.total + o.giftWrapFee - o.pointsDiscount - o.creditUsed);
  o.editedAt = new Date();
  o.history.push({ status: o.status, at: new Date(), by: user.name, note: `Edited: total ${before} → ${o.total}` });
  await o.save();
  await audit(store, actorEmail(user), "order.edit", `#${number}`, before, o.total);
  refresh(store);
  return { ok: `Order updated. New total ${formatMoney(o.total, store.currency)}.` };
}

// ---------- Expenses (F-82) and attendance (F-84) ----------

export async function addExpense(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "reports");
  if (!store.features["F-82"]) return { error: "Expense tracking (F-82) is off." };
  const amount = Number(form.get("amount"));
  const dateStr = String(form.get("date") ?? "");
  if (!(amount > 0)) return { error: "Enter the amount." };
  const date = dateStr ? new Date(`${dateStr}T12:00:00+05:00`) : new Date();
  await m.Expense.create({ date, amount, category: String(form.get("category") ?? "Other").slice(0, 40), note: String(form.get("note") ?? "").slice(0, 200) });
  await audit(store, actorEmail(user), "expense.add", undefined, undefined, amount);
  refresh(store);
  return { ok: "Expense added." };
}

export async function deleteExpense(site: string, id: string) {
  const { store, m } = await ctx(site, "reports");
  if (Types.ObjectId.isValid(id)) await m.Expense.deleteOne({ _id: id });
  refresh(store);
}

export async function clock(site: string, action: "in" | "out") {
  const store = await getStore(site);
  if (!store || !store.features["F-84"]) return;
  const user = await requireStaff(store);
  const m = await storeModels(store);
  const open = await m.Attendance.findOne({ staff: user._id, clockOut: { $exists: false } });
  if (action === "in" && !open) await m.Attendance.create({ staff: user._id, name: user.name, clockIn: new Date() });
  if (action === "out" && open) { open.clockOut = new Date(); await open.save(); }
  refresh(store);
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
  giftWrapFee: z.coerce.number().min(0).default(0),
  deliverySlots: z.string().max(1000).optional().default("").transform((v) => v.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12)),
  ntn: z.string().trim().max(30).optional().default(""),
  gstNumber: z.string().trim().max(30).optional().default(""),
  pointsPer: z.coerce.number().min(1).default(100),
  pointValue: z.coerce.number().min(0).default(1),
  referralReward: z.coerce.number().min(0).default(0),
  refundApprovalAbove: z.coerce.number().min(0).default(10000),
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

// ---------- Bulk import and editing (F-90, F-91) ----------

export async function importProductsCsv(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "catalog");
  if (!store.features["F-90"]) return { error: "Turn on bulk import (F-90) first." };
  const file = form.get("file");
  const text = file instanceof File && file.size ? await file.text() : String(form.get("csv") ?? "");
  if (!text.trim()) return { error: "Choose a CSV file or paste CSV text." };
  if (text.length > 2_000_000) return { error: "That file is too big. Split it into files under 2 MB." };
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "The CSV needs a header row and at least one product." };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const col = (r: string[], k: string) => { const i = head.indexOf(k); return i >= 0 ? (r[i] ?? "").trim() : undefined; };
  if (!head.includes("name") || !head.includes("price")) return { error: 'The header row must include "name" and "price" columns.' };
  const { Instance, Plan } = platformModels(await platformDb());
  const inst = await Instance.findById(store.id).lean();
  const plan = inst ? await Plan.findById(inst.plan).lean() : null;
  const max = inst?.limitOverrides?.maxProducts ?? plan?.maxProducts ?? 0;
  let count = await m.Product.countDocuments();
  let created = 0, updated = 0;
  const errors: string[] = [];
  for (const [n, r] of rows.slice(1, 2001).entries()) {
    const name = col(r, "name");
    const price = Number(col(r, "price"));
    if (!name || !(price >= 0)) { errors.push(`Row ${n + 2}: needs a name and a price`); continue; }
    const num = (k: string) => { const v = col(r, k); return v === undefined || v === "" ? undefined : Number(v); };
    const doc: Record<string, unknown> = { name: name.slice(0, 200), price };
    for (const [k, field] of [["compare_at_price", "compareAtPrice"], ["stock", "stock"], ["cost_price", "costPrice"], ["wholesale_price", "wholesalePrice"]] as const) {
      const v = num(k); if (v !== undefined && v >= 0) doc[field] = field === "stock" ? Math.floor(v) : v;
    }
    for (const k of ["category", "brand", "sku", "barcode", "description"] as const) { const v = col(r, k); if (v !== undefined) doc[k] = v.slice(0, k === "description" ? 5000 : 80); }
    const st = col(r, "status"); if (st === "active" || st === "draft") doc.status = st;
    const imgs = col(r, "images"); if (imgs !== undefined) doc.images = imgs.split(/\s+/).filter((x) => /^https?:\/\/\S+$/i.test(x)).slice(0, 12);
    const tags = col(r, "tags"); if (tags !== undefined) doc.tags = tags.split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 20);
    const slugIn = col(r, "slug");
    const sku = doc.sku as string | undefined;
    const existing = slugIn ? await m.Product.findOne({ slug: slugIn.toLowerCase() }) : sku ? await m.Product.findOne({ sku }) : null;
    if (existing) {
      await m.Product.updateOne({ _id: existing._id }, { $set: doc });
      updated++;
      if (doc.stock !== undefined) await sendBackInStock(store, m, String(existing._id));
    } else {
      if (max > 0 && count >= max) { errors.push(`Row ${n + 2}: plan limit of ${max} products reached`); continue; }
      let slug = slugify(slugIn || name);
      if (await m.Product.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}${n}`;
      await m.Product.create({ ...doc, slug });
      created++; count++;
    }
  }
  if (rows.length > 2001) errors.push("Only the first 2,000 rows were imported.");
  await audit(store, actorEmail(user), "product.import", undefined, undefined, { created, updated });
  refresh(store);
  const msg = `Imported: ${created} new, ${updated} updated.`;
  return errors.length ? { error: `${msg} ${errors.length} problem(s): ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? "…" : ""}` } : { ok: msg };
}

export async function bulkUpdate(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "catalog");
  if (!store.features["F-91"]) return { error: "Turn on bulk editing (F-91) first." };
  let changed = 0;
  const touched: string[] = [];
  for (const [k, v] of form.entries()) {
    const mt = k.match(/^(price|stock)_([a-f0-9]{24})(?:_([a-f0-9]{24}))?$/);
    if (!mt || typeof v !== "string" || v.trim() === "") continue;
    const val = Number(v);
    if (!(val >= 0) || (mt[1] === "stock" && !Number.isInteger(val))) return { error: `Check the value "${v}".` };
    const [, field, pid, vid] = mt;
    const r = vid
      ? await m.Product.updateOne({ _id: pid, "variants._id": new Types.ObjectId(vid) }, { $set: { [`variants.$.${field}`]: val } })
      : await m.Product.updateOne({ _id: pid }, { $set: { [field]: val } });
    if (r.modifiedCount) { changed++; if (field === "stock") touched.push(pid); }
  }
  // Percentage price change for all listed products, if given.
  const pct = Number(form.get("percent") ?? 0);
  if (pct && pct > -90 && pct < 500) {
    const ids = String(form.get("ids") ?? "").split(",").filter((x) => Types.ObjectId.isValid(x));
    const products = await m.Product.find({ _id: { $in: ids } }, { price: 1 }).lean();
    for (const p of products) await m.Product.updateOne({ _id: p._id }, { $set: { price: Math.max(0, Math.round(p.price * (1 + pct / 100))) } });
    changed += products.length;
  }
  for (const pid of new Set(touched)) await sendBackInStock(store, m, pid);
  await audit(store, actorEmail(user), "product.bulk_update", undefined, undefined, changed);
  refresh(store);
  return { ok: `Saved ${changed} change(s).` };
}

// ---------- Product questions (F-65) ----------

export async function answerQuestion(site: string, id: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "catalog");
  const answer = String(form.get("answer") ?? "").trim().slice(0, 2000);
  if (!answer || !Types.ObjectId.isValid(id)) return { error: "Write an answer first." };
  await m.Question.updateOne({ _id: id }, { $set: { answer, answeredBy: user.name, published: true } });
  refresh(store);
  return { ok: "Answer published." };
}

export async function deleteQuestion(site: string, id: string) {
  const { store, m } = await ctx(site, "catalog");
  if (Types.ObjectId.isValid(id)) await m.Question.deleteOne({ _id: id });
  refresh(store);
}

// ---------- Returns and exchanges (F-46, F-100) ----------

export async function decideReturn(site: string, id: string, decision: "approved" | "rejected" | "completed", form: FormData) {
  const { store, user, m } = await ctx(site, "orders");
  if (!Types.ObjectId.isValid(id)) return;
  const r = await m.Return.findById(id);
  if (!r) return;
  const allowed: Record<string, string[]> = { requested: ["approved", "rejected"], approved: ["completed", "rejected"] };
  if (!allowed[r.status]?.includes(decision)) return;
  r.status = decision;
  r.note = String(form.get("note") ?? "").trim().slice(0, 500) || r.note;
  await r.save();
  if (decision === "completed") {
    const amount = r.items.reduce((n, i) => n + i.price * i.qty, 0);
    if (store.features["F-17"]) await releaseStock(m, linesOf(r.items.map((i) => ({ product: i.product, variant: i.variant, qty: i.qty, name: i.name }))));
    const o = await m.Order.findOne({ number: r.orderNumber });
    if (r.type === "refund" && o) {
      const already = o.refunds.reduce((n, x) => n + x.amount, 0);
      const amt = Math.min(amount, o.total - already);
      if (amt > 0) {
        o.refunds.push({ amount: amt, reason: `Return: ${r.reason}`.slice(0, 200), by: user.name, at: new Date() });
        o.paymentStatus = already + amt >= o.total ? "refunded" : "partially_refunded";
        await o.save();
      }
    } else if (r.type === "credit") {
      await m.User.updateOne({ _id: r.user }, { $inc: { storeCredit: amount }, $push: { creditHistory: { amount, reason: `Return on order #${r.orderNumber}`, at: new Date() } } });
    }
    if (o?.customer.email && store.features["F-41"])
      await sendEmail(m, o.customer.email, `${store.name}: your return for order #${r.orderNumber} is complete`,
        `<p>Hi ${esc(o.customer.name)}, your ${r.type} for order #${r.orderNumber} is complete.</p>`);
  }
  await audit(store, actorEmail(user), `return.${decision}`, `#${r.orderNumber}`);
  refresh(store);
}

// ---------- Support tickets (F-73) ----------

export async function staffReply(site: string, id: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "customers");
  const text = String(form.get("text") ?? "").trim().slice(0, 4000);
  if (!text || !Types.ObjectId.isValid(id)) return { error: "Write a reply first." };
  const close = form.get("close") === "1";
  const t = await m.Ticket.findByIdAndUpdate(id, { $push: { messages: { from: "staff", name: user.name, text, at: new Date() } }, $set: { status: close ? "closed" : "open" } }, { returnDocument: "after" }).lean();
  if (t?.email && store.features["F-41"])
    await sendEmail(m, t.email, `${store.name}: reply to “${t.subject}”`, `<p>${esc(text).replace(/\n/g, "<br>")}</p><p>— ${esc(user.name)}, ${esc(store.name)}</p>`);
  refresh(store);
  return { ok: close ? "Reply sent and ticket closed." : "Reply sent." };
}

export async function setTicketStatus(site: string, id: string, status: "open" | "closed") {
  const { store, m } = await ctx(site, "customers");
  if (Types.ObjectId.isValid(id)) await m.Ticket.updateOne({ _id: id }, { $set: { status } });
  refresh(store);
}

// ---------- Customers: store credit (F-56), wholesale (F-61) ----------

export async function adjustCredit(site: string, userId: string, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "customers");
  if (!store.features["F-56"]) return { error: "Turn on store credit (F-56) first." };
  const amount = Math.round(Number(form.get("amount")));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 120) || "Adjusted by store";
  if (!amount || !Types.ObjectId.isValid(userId)) return { error: "Enter an amount (negative to remove credit)." };
  const u = await m.User.findOne({ _id: userId, role: "customer" });
  if (!u) return { error: "Customer not found." };
  if (u.storeCredit + amount < 0) return { error: `They only have ${formatMoney(u.storeCredit, store.currency)} credit.` };
  u.storeCredit += amount;
  u.creditHistory.push({ amount, reason, at: new Date() });
  await u.save();
  await audit(store, actorEmail(user), "customer.credit", u.email, undefined, amount);
  refresh(store);
  return { ok: `Credit is now ${formatMoney(u.storeCredit, store.currency)}.` };
}

export async function setWholesale(site: string, userId: string, on: boolean) {
  const { store, user, m } = await ctx(site, "customers");
  if (!store.features["F-61"] || !Types.ObjectId.isValid(userId)) return;
  const u = await m.User.findOneAndUpdate({ _id: userId, role: "customer" }, { $set: { wholesale: on } }).lean();
  if (u) await audit(store, actorEmail(user), on ? "customer.wholesale_on" : "customer.wholesale_off", u.email);
  refresh(store);
}

// ---------- Content pages and blog (F-40) ----------

export async function savePage(site: string, id: string | null, _: MState, form: FormData): Promise<MState> {
  const { store, user, m } = await ctx(site, "settings");
  if (!store.features["F-40"]) return { error: "Turn on Blog and content pages (F-40) first." };
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const kind: "post" | "page" = form.get("kind") === "post" ? "post" : "page";
  if (title.length < 2) return { error: "Give it a title." };
  const doc = {
    title, kind,
    body: String(form.get("body") ?? "").slice(0, 50000),
    excerpt: String(form.get("excerpt") ?? "").trim().slice(0, 300),
    published: form.get("published") === "1",
  };
  if (id) {
    if (!Types.ObjectId.isValid(id)) return { error: "Unknown page." };
    await m.Page.updateOne({ _id: id }, { $set: doc });
  } else {
    let slug = slugify(String(form.get("slug") ?? "") || title);
    if (await m.Page.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
    await m.Page.create({ ...doc, slug });
  }
  await audit(store, actorEmail(user), id ? "content.update" : "content.create", title);
  refresh(store);
  if (!id) redirect(`${store.base}/manage/content`);
  return { ok: "Saved." };
}

export async function deletePage(site: string, id: string) {
  const { store, m } = await ctx(site, "settings");
  if (Types.ObjectId.isValid(id)) await m.Page.deleteOne({ _id: id });
  refresh(store);
  redirect(`${store.base}/manage/content`);
}

/** Storefront extras that live in settings but are edited on the Content page (F-117, F-88, F-115, F-76, F-119). */
export async function saveStorefrontExtras(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user } = await ctx(site, "settings");
  const menu = String(form.get("menu") ?? "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([l, u]) => l && u)
    .map(([label, url]) => ({ label: label.slice(0, 40), url: url.slice(0, 300) }));
  for (const mm of menu) if (!/^(\/|https:\/\/)/.test(mm.url)) return { error: `Menu link "${mm.label}" must start with / or https://` };
  const locations = String(form.get("locations") ?? "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([n, a]) => n && a)
    .map(([name, address, phone = "", hours = ""]) => ({ name: name.slice(0, 80), address: address.slice(0, 200), phone: phone.slice(0, 30), hours: hours.slice(0, 80) }));
  const gaId = String(form.get("gaId") ?? "").trim().toUpperCase();
  const pixelId = String(form.get("pixelId") ?? "").trim();
  if (gaId && !/^G-[A-Z0-9]{4,15}$/.test(gaId)) return { error: "Google Analytics IDs look like G-XXXXXXX." };
  if (pixelId && !/^\d{8,20}$/.test(pixelId)) return { error: "A Meta Pixel ID is a long number." };
  const exitOfferCode = String(form.get("exitOfferCode") ?? "").trim().toUpperCase();
  if (exitOfferCode && !/^[A-Z0-9_-]{3,30}$/.test(exitOfferCode)) return { error: "The exit offer must be a discount code (letters and numbers)." };
  const customCss = String(form.get("customCss") ?? "").slice(0, 20000);
  const { Instance } = platformModels(await platformDb());
  await Instance.updateOne({ _id: store.id }, { $set: {
    "settings.menu": menu.slice(0, 8), "settings.locations": locations.slice(0, 30), "settings.gaId": gaId, "settings.pixelId": pixelId,
    "settings.exitOfferCode": exitOfferCode, "settings.customCss": customCss,
  } });
  await audit(store, actorEmail(user), "settings.storefront");
  refresh(store);
  return { ok: "Storefront settings saved." };
}

// ---------- Developer API and webhooks (F-112) ----------

export async function createApiKey(site: string, _: SecretState, form: FormData): Promise<SecretState> {
  const { store, user, m } = await ctx(site, "settings");
  if (!store.features["F-112"]) return { error: "Turn on Owner API access (F-112) first." };
  if ((await m.ApiKey.countDocuments()) >= 10) return { error: "You can have up to 10 keys. Revoke one first." };
  const name = String(form.get("name") ?? "").trim().slice(0, 60) || "API key";
  const key = `sk_${crypto.randomBytes(24).toString("base64url")}`;
  await m.ApiKey.create({ name, prefix: key.slice(0, 10), hash: crypto.createHash("sha256").update(key).digest("hex") });
  await audit(store, actorEmail(user), "api.key_create", name);
  refresh(store);
  return { ok: "Key created. Copy it now; it won't be shown again.", key };
}

export async function revokeApiKey(site: string, id: string) {
  const { store, user, m } = await ctx(site, "settings");
  if (!Types.ObjectId.isValid(id)) return;
  const k = await m.ApiKey.findByIdAndDelete(id).lean();
  if (k) await audit(store, actorEmail(user), "api.key_revoke", k.name);
  refresh(store);
}

export async function addWebhook(site: string, _: SecretState, form: FormData): Promise<SecretState> {
  const { store, user, m } = await ctx(site, "settings");
  if (!store.features["F-112"]) return { error: "Turn on Owner API access (F-112) first." };
  const url = String(form.get("url") ?? "").trim();
  if (!isSafeWebhookUrl(url)) return { error: "Use a public https:// address (no localhost or private IPs)." };
  const events = form.getAll("events").map(String).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (!events.length) return { error: "Choose at least one event." };
  if ((await m.Webhook.countDocuments()) >= 10) return { error: "You can have up to 10 webhooks." };
  const secret = `whsec_${crypto.randomBytes(18).toString("base64url")}`;
  await m.Webhook.create({ url, events, secret });
  await audit(store, actorEmail(user), "api.webhook_add", url);
  refresh(store);
  return { ok: "Webhook added. Use this secret to verify the X-Signature header (HMAC-SHA256 of the body).", secret };
}

export async function removeWebhook(site: string, id: string) {
  const { store, m } = await ctx(site, "settings");
  if (Types.ObjectId.isValid(id)) await m.Webhook.deleteOne({ _id: id });
  refresh(store);
}

export async function testWebhooks(site: string) {
  const { store } = await ctx(site, "settings");
  await fireWebhook(store, "order.created", { test: true, number: 0, total: 0 });
  refresh(store);
}

// ---------- Change subdomain (FR-S-04: once per 30 days) ----------

export async function changeSubdomain(site: string, _: MState, form: FormData): Promise<MState> {
  const { store, user } = await ctx(site, "settings");
  if (user.role !== "owner") return { error: "Only the store owner can change the address." };
  const v = validateSubdomain(String(form.get("subdomain") ?? ""));
  if (!v.ok) return { error: v.error };
  if (v.value === store.subdomain) return { error: "That's already your address." };
  const { Instance } = platformModels(await platformDb());
  const inst = await Instance.findById(store.id).lean();
  const last = inst?.subdomainChangedAt ? new Date(inst.subdomainChangedAt).getTime() : 0;
  const next = last + 30 * 86400_000;
  if (last && Date.now() < next)
    return { error: `You can change the address again on ${new Date(next).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "long" })}.` };
  if (await Instance.exists({ subdomain: v.value })) return { error: `"${v.value}" is already taken.` };
  await Instance.updateOne({ _id: store.id }, { $set: { subdomain: v.value, subdomainChangedAt: new Date() } });
  await audit(store, actorEmail(user), "store.subdomain", undefined, store.subdomain, v.value);
  revalidatePath("/", "layout");
  // Path mode moves to the new path; on a subdomain host go to the new host; a custom domain keeps working.
  const onCustomDomain = !store.base && !!store.customDomain && (await headers()).get("host")?.split(":")[0] === store.customDomain;
  redirect(store.base ? `/s/${v.value}/manage/settings` : onCustomDomain ? "/manage/settings" : `${storeUrl(v.value)}/manage/settings`);
}
