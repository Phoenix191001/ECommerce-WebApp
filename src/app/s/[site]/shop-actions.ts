"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { getStore, priceOrder, storeModels, formatMoney, type StoreContext } from "@/lib/tenant";
import { cartCookie, evaluateDiscount, findCart, viewCart } from "@/lib/cart";
import { createStoreSession, destroyStoreSession, getCurrentUser, getStoreSession } from "@/lib/store-auth";
import { loginAs, type LoginResult } from "@/lib/store-login";
import { nextOrderNumber } from "@/lib/models/tenant";
import { esc, sendEmail } from "@/lib/email";
import { findVariant, hasVariants, isPublished, stockOf } from "@/lib/pricing";
import { linesOf, reserveStock } from "@/lib/stock";
import { scoreOrder } from "@/lib/risk";
import { fireWebhook } from "@/lib/webhooks";
import { newTotpSecret, verifyTotp } from "@/lib/totp";

export type ShopState = { error?: string; ok?: string; needCode?: boolean } | undefined;

async function store(site: string): Promise<StoreContext> {
  const s = await getStore(site);
  if (!s || s.status !== "active") throw new Error("This store is not available.");
  return s;
}

const refresh = (s: StoreContext) => revalidatePath(`/s/${s.subdomain}`, "layout");

async function customerOrLogin(s: StoreContext) {
  const u = await getCurrentUser(s);
  if (!u || u.role !== "customer") redirect(`${s.base}/account/login`);
  return u;
}

// ---------- Cart ----------

export async function addToCart(site: string, productId: string, qty = 1, variantId?: string): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-01"]) return { error: "The catalog is turned off." };
  if (!Types.ObjectId.isValid(productId)) return { error: "Unknown product." };
  const m = await storeModels(s);
  const p = await m.Product.findOne({ _id: productId, status: "active" }).lean();
  if (!p || !isPublished(p, s.features)) return { error: "That product is no longer available." };
  let vid: string | undefined;
  if (s.features["F-02"] && hasVariants(p)) {
    const v = findVariant(p, variantId);
    if (!v) return { error: `Choose ${p.optionNames?.length ? p.optionNames.join(" and ").toLowerCase() : "an option"} first.` };
    vid = String(v._id);
  }
  const cart = (await findCart(s, true))!;
  const ex = cart.items.find((i) => String(i.product) === productId && String(i.variant ?? "") === (vid ?? ""));
  const want = (ex?.qty ?? 0) + Math.max(1, Math.min(99, Math.floor(qty)));
  const stock = stockOf(p, vid);
  if (s.features["F-17"] && want > stock)
    return { error: stock > 0 ? `Only ${stock} left in stock.` : "Sorry, this is out of stock." };
  if (ex) ex.qty = want;
  else
    cart.items.push({
      product: p._id,
      variant: vid ? new Types.ObjectId(vid) : undefined,
      variantName: vid ? findVariant(p, vid)?.name : undefined,
      name: p.name,
      price: p.price,
      qty: want,
    });
  await cart.save();
  refresh(s);
  return { ok: `Added ${p.name} to your cart.` };
}

/** `key` is "productId" or "productId:variantId". */
export async function setCartQty(site: string, key: string, qty: number) {
  const s = await store(site);
  const cart = await findCart(s);
  if (!cart) return;
  const [pid, vid] = key.split(":");
  const match = (i: { product: unknown; variant?: unknown }) => String(i.product) === pid && String(i.variant ?? "") === (vid ?? "");
  const it = cart.items.find(match);
  if (!it) return;
  if (qty <= 0) cart.items = cart.items.filter((i) => !match(i));
  else it.qty = Math.min(999, Math.floor(qty));
  await cart.save();
  refresh(s);
}

export async function applyCode(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-27"]) return { error: "Discount codes aren't available in this store." };
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const cart = await findCart(s, true);
  const view = await viewCart(s);
  if (!code) {
    cart!.discountCode = undefined;
    await cart!.save();
    refresh(s);
    return { ok: "Code removed." };
  }
  const d = await evaluateDiscount(s, code, view.subtotal);
  if (d.error) return { error: d.error };
  cart!.discountCode = d.code;
  await cart!.save();
  refresh(s);
  return { ok: `Code ${d.code} applied: you save ${formatMoney(d.amount, s.currency)}.` };
}

// ---------- Checkout (FR-C-03, FR-C-04) ----------

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.email("Enter a valid email so we can send your confirmation."),
  phone: z.string().trim().min(7, "Enter a phone number the courier can call."),
  address: z.string().trim().max(300).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  delivery: z.enum(["shipping", "pickup"]).default("shipping"),
  payment: z.enum(["cod", "card", "wallet"]),
  note: z.string().trim().max(500).optional().default(""),
  slot: z.string().trim().max(80).optional().default(""),
  giftWrap: z.string().optional(),
  giftMessage: z.string().trim().max(300).optional().default(""),
  usePoints: z.string().optional(),
  useCredit: z.string().optional(),
  saveAddress: z.string().optional(),
});

export async function placeOrder(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  const f = s.features;
  const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const user = await getCurrentUser(s);
  const customer = user?.role === "customer" ? user : null;
  if (!customer && !f["F-19"]) return { error: "Please sign in or create an account to check out." };
  if (d.delivery === "shipping" && (!d.address || !d.city)) return { error: "Enter your delivery address and city." };
  if (d.delivery === "pickup" && !f["F-59"]) return { error: "Pickup isn't available in this store." };
  if (d.payment === "cod" && !f["F-23"]) return { error: "Cash on delivery isn't available. Choose another payment method." };
  if (d.payment !== "cod") return { error: "Online payment isn't set up for this store yet. Please choose cash on delivery." };
  if (f["F-60"] && d.delivery === "shipping" && s.settings.deliverySlots.length && !s.settings.deliverySlots.includes(d.slot))
    return { error: "Choose a delivery time slot." };

  const cart = await findCart(s);
  const view = await viewCart(s);
  if (!cart || !view.items.length) return { error: "Your cart is empty." };
  const disc = await evaluateDiscount(s, view.discountCode, view.subtotal);
  const base = priceOrder(s, view.subtotal, disc.amount, d.delivery);
  const m = await storeModels(s);

  // Extras on top of the priced order.
  const giftWrap = !!(f["F-74"] && d.giftWrap);
  const giftWrapFee = giftWrap ? s.settings.giftWrapFee : 0;
  let total = base.total + giftWrapFee;
  let pointsRedeemed = 0;
  let pointsDiscount = 0;
  let creditUsed = 0;
  if (customer && f["F-28"] && d.usePoints && customer.loyaltyPoints > 0 && s.settings.pointValue > 0) {
    pointsDiscount = Math.min(total, Math.floor(customer.loyaltyPoints * s.settings.pointValue));
    pointsRedeemed = Math.ceil(pointsDiscount / s.settings.pointValue);
    total -= pointsDiscount;
  }
  if (customer && f["F-56"] && d.useCredit && customer.storeCredit > 0) {
    creditUsed = Math.min(total, customer.storeCredit);
    total -= creditUsed;
  }

  // F-17 / F-101: reserve stock atomically (per variant); roll back if any item is short.
  if (f["F-17"]) {
    const r = await reserveStock(m, linesOf(view.items));
    if (r.short) return { error: `Sorry, there isn't enough stock of ${r.short}. Lower the quantity and try again.` };
  }
  if (disc.code) await m.Discount.updateOne({ code: disc.code }, { $inc: { used: 1 } });
  if (customer && (pointsRedeemed || creditUsed)) {
    await m.User.updateOne(
      { _id: customer._id },
      {
        $inc: { loyaltyPoints: -pointsRedeemed, storeCredit: -creditUsed },
        ...(creditUsed ? { $push: { creditHistory: { amount: -creditUsed, reason: "Used at checkout", at: new Date() } } } : {}),
      },
    );
  }
  if (customer && f["F-107"] && d.saveAddress && d.address && !customer.addresses.some((a) => a.address === d.address)) {
    await m.User.updateOne({ _id: customer._id }, { $push: { addresses: { label: "Home", address: d.address, city: d.city, phone: d.phone } } });
  }

  const risk = f["F-106"]
    ? await scoreOrder(m, { total, email: d.email, phone: d.phone, address: d.address, signedIn: !!customer })
    : { score: 0, reasons: [] };
  const costs = new Map(
    (await m.Product.find({ _id: { $in: view.items.map((i) => i.product) } }, { costPrice: 1 }).lean()).map((p) => [String(p._id), p.costPrice ?? 0]),
  );
  const number = await nextOrderNumber(m);
  const trackingToken = crypto.randomBytes(16).toString("base64url");
  const order = await m.Order.create({
    number,
    channel: "online",
    user: customer?._id,
    customer: { name: d.name, email: d.email, phone: d.phone, address: d.address, city: d.city },
    delivery: d.delivery,
    items: view.items.map((i) => ({
      product: new Types.ObjectId(i.product),
      variant: i.variant ? new Types.ObjectId(i.variant) : undefined,
      variantName: i.variantName,
      name: i.name,
      price: i.price,
      qty: i.qty,
      cost: costs.get(i.product) ?? 0,
    })),
    ...base,
    total,
    discountCode: disc.code,
    giftWrap,
    giftWrapFee,
    giftMessage: giftWrap ? d.giftMessage : "",
    deliverySlot: f["F-60"] && d.delivery === "shipping" ? d.slot : "",
    pointsRedeemed,
    pointsDiscount,
    creditUsed,
    riskScore: risk.score,
    riskReasons: risk.reasons,
    paymentMethod: "cod",
    paymentStatus: "unpaid",
    status: "pending",
    history: [{ status: "pending", at: new Date(), note: "Order placed" }],
    trackingToken,
    note: d.note,
  });
  cart.items = [];
  cart.discountCode = undefined;
  await cart.save();

  if (f["F-41"]) {
    const rows = order.items
      .map((i) => `<tr><td>${esc(i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ""} × ${i.qty}</td><td align="right">${formatMoney(i.price * i.qty, s.currency)}</td></tr>`)
      .join("");
    await sendEmail(
      m,
      d.email,
      `${s.name}: order #${number} received`,
      `<h2>Thank you, ${esc(d.name)}!</h2><p>We received your order #${number}.</p><table width="100%">${rows}<tr><td><b>Total</b></td><td align="right"><b>${formatMoney(order.total, s.currency)}</b></td></tr></table><p>Payment: cash on delivery.</p>`,
    );
  }
  await fireWebhook(s, "order.created", { number, total, items: order.items.length, customer: { name: d.name, city: d.city } }).catch(() => {});
  redirect(`${s.base}/order/${number}?t=${trackingToken}&new=1`);
}

// ---------- Order tracking (F-51) ----------

export async function trackOrder(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-51"]) return { error: "Order tracking isn't available." };
  const number = Number(String(form.get("number") ?? "").replace(/\D/g, ""));
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const m = await storeModels(s);
  const o = number ? await m.Order.findOne({ number, "customer.email": email }).lean() : null;
  if (!o) return { error: "We couldn't find an order with that number and email. Check both and try again." };
  redirect(`${s.base}/order/${o.number}?t=${o.trackingToken}`);
}

export async function reorder(site: string, orderNumber: number) {
  const s = await store(site);
  if (!s.features["F-102"]) return;
  const user = await customerOrLogin(s);
  const m = await storeModels(s);
  const o = await m.Order.findOne({ number: orderNumber, user: user._id }).lean();
  if (!o) return;
  for (const it of o.items)
    await addToCart(site, String(it.product), it.qty, it.variant ? String(it.variant) : undefined).catch(() => {});
  redirect(`${s.base}/cart`);
}

// ---------- Customer accounts (F-22, F-121, F-69, F-70) ----------

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password."),
  referral: z.string().trim().max(20).optional().default(""),
  newsletter: z.string().optional(),
});

const newReferralCode = () => crypto.randomBytes(4).toString("hex").toUpperCase();

export async function register(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-22"]) return { error: "Accounts aren't available in this store." };
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const m = await storeModels(s);
  if (await m.User.exists({ email: d.email.toLowerCase() })) return { error: "An account with that email already exists. Sign in instead." };
  let referredBy: Types.ObjectId | undefined;
  if (s.features["F-70"] && d.referral) {
    const ref = await m.User.findOne({ referralCode: d.referral.toUpperCase(), role: "customer" }, { _id: 1 }).lean();
    if (!ref) return { error: "That referral code isn't valid. Check it or leave it empty." };
    referredBy = ref._id;
  }
  const u = await m.User.create({
    name: d.name,
    email: d.email,
    passwordHash: await bcrypt.hash(d.password, 12),
    role: "customer",
    referredBy,
    referralCode: s.features["F-70"] ? newReferralCode() : undefined,
    newsletter: !!(s.features["F-44"] && d.newsletter),
  });
  if (s.features["F-44"] && d.newsletter) await m.Subscriber.updateOne({ email: d.email.toLowerCase() }, { $setOnInsert: { email: d.email.toLowerCase() } }, { upsert: true });
  await createStoreSession(s, String(u._id), "customer");
  redirect(`${s.base}/account`);
}

export async function customerLogin(site: string, _: ShopState, form: FormData): Promise<LoginResult> {
  const s = await store(site);
  if (!s.features["F-22"]) return { error: "Accounts aren't available in this store." };
  return loginAs(s, form, ["customer"], `${s.base}/account`);
}

export async function logoutStore(site: string, to = "") {
  const s = await getStore(site);
  if (!s) return;
  await destroyStoreSession(s);
  (await cookies()).delete(cartCookie(s));
  redirect(`${s.base}${to}`);
}

/** F-69: start enrolment (creates a secret) or turn two-factor off. */
export async function setCustomerTwoFactor(site: string, on: boolean) {
  const s = await store(site);
  if (!s.features["F-69"]) return;
  const u = await customerOrLogin(s);
  const m = await storeModels(s);
  if (on) await m.User.updateOne({ _id: u._id }, { $set: { totpSecret: newTotpSecret(), totpEnabled: false } });
  else await m.User.updateOne({ _id: u._id }, { $set: { totpEnabled: false }, $unset: { totpSecret: 1 } });
  refresh(s);
}

export async function confirmCustomerTwoFactor(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  const u = await customerOrLogin(s);
  if (!u.totpSecret) return { error: "Start two-factor setup first." };
  if (!verifyTotp(u.totpSecret, String(form.get("code") ?? ""), u.email)) return { error: "That code didn't match. Enter the newest code from your app." };
  const m = await storeModels(s);
  await m.User.updateOne({ _id: u._id }, { $set: { totpEnabled: true } });
  refresh(s);
  return { ok: "Two-factor sign-in is on." };
}

// ---------- Addresses (F-107) ----------

export async function addAddress(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-107"]) return { error: "Saved addresses are turned off." };
  const u = await customerOrLogin(s);
  const a = {
    label: String(form.get("label") ?? "").trim().slice(0, 30) || "Home",
    address: String(form.get("address") ?? "").trim().slice(0, 300),
    city: String(form.get("city") ?? "").trim().slice(0, 80),
    phone: String(form.get("phone") ?? "").trim().slice(0, 30),
  };
  if (!a.address || !a.city) return { error: "Enter the address and city." };
  if (u.addresses.length >= 10) return { error: "You can save up to 10 addresses." };
  const m = await storeModels(s);
  await m.User.updateOne({ _id: u._id }, { $push: { addresses: a } });
  refresh(s);
  return { ok: "Address saved." };
}

export async function removeAddress(site: string, id: string) {
  const s = await store(site);
  const u = await customerOrLogin(s);
  if (!Types.ObjectId.isValid(id)) return;
  const m = await storeModels(s);
  await m.User.updateOne({ _id: u._id }, { $pull: { addresses: { _id: new Types.ObjectId(id) } } });
  refresh(s);
}

// ---------- Returns and exchanges (F-46, F-100) ----------

export async function requestReturn(site: string, orderNumber: number, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-46"]) return { error: "Returns aren't available in this store." };
  const u = await customerOrLogin(s);
  const m = await storeModels(s);
  const o = await m.Order.findOne({ number: orderNumber, user: u._id }).lean();
  if (!o) return { error: "Order not found." };
  if (o.status !== "delivered") return { error: "You can request a return once the order is delivered." };
  if (await m.Return.exists({ orderNumber, status: { $in: ["requested", "approved"] } })) return { error: "There's already an open return for this order." };
  const rawType = String(form.get("type") ?? "refund");
  if (rawType !== "refund" && rawType !== "exchange" && rawType !== "credit") return { error: "Choose what you'd like." };
  const type: "refund" | "exchange" | "credit" = rawType;
  if (type === "exchange" && !s.features["F-100"]) return { error: "Exchanges aren't available in this store." };
  if (type === "credit" && !s.features["F-56"]) return { error: "Store credit isn't available in this store." };
  const items = o.items
    .map((i, idx) => ({ i, qty: Math.max(0, Math.min(i.qty, Math.floor(Number(form.get(`qty_${idx}`) ?? 0)))) }))
    .filter((x) => x.qty > 0)
    .map(({ i, qty }) => ({ product: i.product, variant: i.variant, name: i.variantName ? `${i.name} (${i.variantName})` : i.name, qty, price: i.price }));
  if (!items.length) return { error: "Choose at least one item to return." };
  const reason = String(form.get("reason") ?? "").trim().slice(0, 1000);
  if (reason.length < 5) return { error: "Tell us briefly why you're returning it." };
  await m.Return.create({ orderNumber, user: u._id, customerName: u.name, items, type, reason });
  refresh(s);
  return { ok: "Return requested. The store will review it and contact you." };
}

// ---------- Support tickets (F-73) ----------

export async function openTicket(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-73"]) return { error: "Support tickets aren't available." };
  const u = await customerOrLogin(s);
  const subject = String(form.get("subject") ?? "").trim().slice(0, 200);
  const text = String(form.get("text") ?? "").trim().slice(0, 4000);
  const orderNumber = Number(String(form.get("order") ?? "").replace(/\D/g, "")) || undefined;
  if (subject.length < 3 || text.length < 5) return { error: "Add a subject and a short message." };
  const m = await storeModels(s);
  await m.Ticket.create({ user: u._id, customerName: u.name, email: u.email, subject, orderNumber, messages: [{ from: "customer", name: u.name, text, at: new Date() }] });
  refresh(s);
  return { ok: "Ticket sent. You'll see replies here." };
}

export async function replyTicket(site: string, id: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  const u = await customerOrLogin(s);
  const text = String(form.get("text") ?? "").trim().slice(0, 4000);
  if (!text || !Types.ObjectId.isValid(id)) return { error: "Write a message first." };
  const m = await storeModels(s);
  const r = await m.Ticket.updateOne({ _id: id, user: u._id }, { $push: { messages: { from: "customer", name: u.name, text, at: new Date() } }, $set: { status: "open" } });
  if (!r.matchedCount) return { error: "Ticket not found." };
  refresh(s);
  return { ok: "Sent." };
}

// ---------- Newsletter (F-44), back-in-stock (F-14), questions (F-65) ----------

export async function subscribe(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-44"]) return { error: "The newsletter isn't available." };
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email address." };
  const m = await storeModels(s);
  await m.Subscriber.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true });
  return { ok: "You're subscribed. Thanks!" };
}

export async function notifyWhenBack(site: string, productId: string, variantId: string | undefined, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-14"]) return { error: "Stock alerts aren't available." };
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email address." };
  if (!Types.ObjectId.isValid(productId)) return { error: "Unknown product." };
  const m = await storeModels(s);
  const filter = { product: new Types.ObjectId(productId), variant: variantId && Types.ObjectId.isValid(variantId) ? new Types.ObjectId(variantId) : undefined, email, notified: false };
  await m.StockAlert.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
  return { ok: "We'll email you when it's back in stock." };
}

export async function askQuestion(site: string, productId: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-65"]) return { error: "Questions are turned off." };
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const question = String(form.get("question") ?? "").trim().slice(0, 1000);
  if (name.length < 2 || question.length < 5) return { error: "Add your name and a question." };
  const m = await storeModels(s);
  const p = Types.ObjectId.isValid(productId) ? await m.Product.findById(productId, { name: 1 }).lean() : null;
  if (!p) return { error: "Unknown product." };
  await m.Question.create({ product: p._id, productName: p.name, name, question });
  return { ok: "Thanks! Your question will appear once the store answers it." };
}

// ---------- Wishlist (F-10), reviews (F-04), compare (F-11), language (F-16) ----------

export async function toggleWishlist(site: string, productId: string) {
  const s = await store(site);
  if (!s.features["F-10"] || !Types.ObjectId.isValid(productId)) return;
  const session = await getStoreSession(s);
  if (session?.role !== "customer") redirect(`${s.base}/account/login`);
  const m = await storeModels(s);
  const u = await m.User.findById(session.uid);
  if (!u) return;
  const has = u.wishlist.some((w) => String(w) === productId);
  u.wishlist = has ? u.wishlist.filter((w) => String(w) !== productId) : [...u.wishlist, new Types.ObjectId(productId)];
  await u.save();
  refresh(s);
}

export async function addReview(site: string, productId: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-04"]) return { error: "Reviews are turned off." };
  const user = await getCurrentUser(s);
  if (!user || user.role !== "customer") return { error: "Sign in to write a review." };
  const rating = Math.round(Number(form.get("rating")));
  const text = String(form.get("text") ?? "").trim().slice(0, 2000);
  if (!(rating >= 1 && rating <= 5)) return { error: "Choose a rating from 1 to 5 stars." };
  const m = await storeModels(s);
  await m.Review.updateOne({ product: productId, user: user._id }, { $set: { rating, text, name: user.name } }, { upsert: true });
  const agg = await m.Review.aggregate<{ avg: number; n: number }>([
    { $match: { product: new Types.ObjectId(productId) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  await m.Product.updateOne({ _id: productId }, { $set: { ratingAvg: agg[0]?.avg ?? 0, ratingCount: agg[0]?.n ?? 0 } });
  refresh(s);
  return { ok: "Thanks! Your review is posted." };
}

const COMPARE_MAX = 4;

export async function toggleCompare(site: string, productId: string) {
  const s = await store(site);
  if (!s.features["F-11"] || !Types.ObjectId.isValid(productId)) return;
  const jar = await cookies();
  const key = `cmp_${s.id}`;
  const list = (jar.get(key)?.value ?? "").split(",").filter((x) => Types.ObjectId.isValid(x));
  const next = list.includes(productId) ? list.filter((x) => x !== productId) : [...list, productId].slice(-COMPARE_MAX);
  jar.set(key, next.join(","), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  refresh(s);
}

export async function setLanguage(site: string, lang: "en" | "ur") {
  const s = await store(site);
  (await cookies()).set(`lang_${s.id}`, lang === "ur" ? "ur" : "en", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  refresh(s);
}

export async function setTheme(site: string, theme: "light" | "dark") {
  const s = await store(site);
  (await cookies()).set(`theme_${s.id}`, theme === "dark" ? "dark" : "light", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  refresh(s);
}
