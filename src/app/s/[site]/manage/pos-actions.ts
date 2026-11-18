"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { getStore, storeModels, formatMoney } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { nextOrderNumber } from "@/lib/models/tenant";
import { findVariant, unitPrice } from "@/lib/pricing";
import { linesOf, reserveStock } from "@/lib/stock";
import { fireWebhook } from "@/lib/webhooks";

export type PosResult = { error?: string; ok?: string; number?: number; needsPin?: boolean; report?: ShiftReport };
export type ShiftReport = { openingCash: number; cashSales: number; cashRefunds: number; expected: number; counted: number; difference: number };

async function ctx(site: string) {
  const store = await getStore(site);
  if (!store) throw new Error("Store not found");
  if (!store.features["F-34"]) throw new Error("The POS (F-34) is turned off.");
  const user = await requireStaff(store, "pos");
  return { store, user, m: await storeModels(store) };
}

async function openShiftOf(m: Awaited<ReturnType<typeof storeModels>>, uid: Types.ObjectId) {
  return m.Shift.findOne({ cashier: uid, closedAt: { $exists: false } });
}

/** FR-P-01 */
export async function openShift(site: string, _: PosResult | undefined, form: FormData): Promise<PosResult> {
  const { store, user, m } = await ctx(site);
  if (!store.features["F-36"]) return { error: "Shifts (F-36) are turned off." };
  if (await openShiftOf(m, user._id)) return { error: "You already have an open shift." };
  const openingCash = Math.round(Number(form.get("openingCash")));
  if (!(openingCash >= 0)) return { error: "Count the cash in the drawer and enter the amount." };
  await m.Shift.create({ cashier: user._id, cashierName: user.name, openedAt: new Date(), openingCash });
  revalidatePath(`/s/${store.subdomain}/manage/pos`);
  return { ok: "Shift opened." };
}

/** FR-P-04: expected cash, counted cash, and the difference. */
export async function closeShift(site: string, _: PosResult | undefined, form: FormData): Promise<PosResult> {
  const { store, user, m } = await ctx(site);
  const shift = await openShiftOf(m, user._id);
  if (!shift) return { error: "No open shift." };
  const counted = Math.round(Number(form.get("countedCash")));
  if (!(counted >= 0)) return { error: "Count the cash in the drawer and enter the amount." };
  shift.closedAt = new Date();
  shift.countedCash = counted;
  await shift.save();
  const expected = shift.openingCash + shift.cashSales - shift.cashRefunds;
  // No revalidation here: the cashier needs to see this report before the page resets.
  void store;
  return {
    ok: "Shift closed.",
    report: { openingCash: shift.openingCash, cashSales: shift.cashSales, cashRefunds: shift.cashRefunds, expected, counted, difference: counted - expected },
  };
}

export async function posSale(site: string, lines: { id: string; variant?: string; qty: number }[], tendered: number): Promise<PosResult> {
  const { store, user, m } = await ctx(site);
  const shift = store.features["F-36"] ? await openShiftOf(m, user._id) : null;
  if (store.features["F-36"] && !shift) return { error: "Open a shift before selling." };
  const clean = lines
    .filter((l) => Types.ObjectId.isValid(l.id) && l.qty > 0 && (!l.variant || Types.ObjectId.isValid(l.variant)))
    .map((l) => ({ id: l.id, variant: l.variant, qty: Math.min(999, Math.floor(l.qty)) }));
  if (!clean.length) return { error: "The sale is empty." };
  const products = await m.Product.find({ _id: { $in: clean.map((l) => l.id) } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const items = clean
    .filter((l) => byId.has(l.id))
    .map((l) => {
      const p = byId.get(l.id)!;
      const v = findVariant(p, l.variant);
      return {
        product: p._id,
        variant: v ? new Types.ObjectId(String(v._id)) : undefined,
        variantName: v?.name,
        name: p.name,
        price: unitPrice(p, v ? String(v._id) : undefined, l.qty, { features: store.features }).price,
        qty: l.qty,
        cost: p.costPrice ?? 0,
      };
    });
  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  const tax = store.features["F-31"] ? Math.round((subtotal * store.settings.taxRate) / 100) : 0;
  const total = subtotal + tax;
  if (!(tendered >= total)) return { error: `Cash received must be at least ${formatMoney(total, store.currency)}.` };

  if (store.features["F-17"]) {
    const r = await reserveStock(m, linesOf(items));
    if (r.short) return { error: `Not enough stock of ${r.short}.` };
  }
  const number = await nextOrderNumber(m);
  await m.Order.create({
    number, channel: "pos", cashier: user._id, shift: shift?._id,
    customer: { name: "", email: "", phone: "", address: "", city: "" },
    delivery: "pickup", items, subtotal, discount: 0, shipping: 0, tax, total,
    paymentMethod: "cash", paymentStatus: "paid", status: "delivered",
    history: [{ status: "delivered", at: new Date(), by: user.name, note: `POS sale · cash ${tendered}, change ${tendered - total}` }],
    trackingToken: crypto.randomBytes(16).toString("base64url"),
    note: `Cash ${tendered} · change ${tendered - total}`,
  });
  if (shift) {
    shift.cashSales += total;
    await shift.save();
  }
  await fireWebhook(store, "order.created", { number, total, channel: "pos" }).catch(() => {});
  revalidatePath(`/s/${store.subdomain}/manage/pos`);
  return { ok: `Sale #${number} complete. Change due: ${formatMoney(tendered - total, store.currency)}.`, number };
}

/** F-37 / F-38 / FR-P-03: refunds within the cashier's limit; larger ones need a manager PIN. */
export async function posRefund(site: string, _: PosResult | undefined, form: FormData): Promise<PosResult> {
  const { store, user, m } = await ctx(site);
  if (!store.features["F-37"]) return { error: "POS refunds (F-37) are turned off." };
  const number = Number(String(form.get("number") ?? "").replace(/\D/g, ""));
  const amount = Math.round(Number(form.get("amount")));
  const pin = String(form.get("pin") ?? "");
  const o = number ? await m.Order.findOne({ number }) : null;
  if (!o) return { error: "Order not found. Check the number on the receipt." };
  if (!(amount > 0)) return { error: "Enter the refund amount." };
  const already = o.refunds.reduce((n, r) => n + r.amount, 0);
  if (amount > o.total - already) return { error: `At most ${formatMoney(o.total - already, store.currency)} can be refunded on this order.` };

  let approvedBy: string | undefined;
  const limit = user.role === "owner" ? Infinity : user.refundLimit ?? 0;
  if (store.features["F-38"] && amount > limit) {
    if (!pin) return { error: `This is above your refund limit of ${formatMoney(limit, store.currency)}. A manager must enter their PIN.`, needsPin: true };
    const managers = await m.User.find({ role: { $in: ["manager", "owner"] }, pinHash: { $exists: true } }).lean();
    for (const mg of managers) if (mg.pinHash && (await bcrypt.compare(pin, mg.pinHash))) { approvedBy = mg.name; break; }
    if (!approvedBy) return { error: "That PIN didn't match any manager.", needsPin: true };
  }
  const shift = store.features["F-36"] ? await openShiftOf(m, user._id) : null;
  if (store.features["F-36"] && !shift) return { error: "Open a shift before giving refunds." };
  o.refunds.push({ amount, reason: "POS refund", by: user.name, approvedBy, at: new Date() });
  const full = already + amount >= o.total;
  o.paymentStatus = full ? "refunded" : "partially_refunded";
  if (full) {
    o.status = "refunded";
    o.history.push({ status: "refunded", at: new Date(), by: user.name, note: approvedBy ? `Approved by ${approvedBy}` : undefined });
  }
  await o.save();
  if (shift) {
    shift.cashRefunds += amount;
    await shift.save();
  }
  return { ok: `Refunded ${formatMoney(amount, store.currency)} in cash on order #${number}${approvedBy ? ` (approved by ${approvedBy})` : ""}.` };
}
