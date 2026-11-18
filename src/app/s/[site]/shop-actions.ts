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
import { loginAs } from "@/lib/store-login";
import { nextOrderNumber } from "@/lib/models/tenant";
import { esc, sendEmail } from "@/lib/email";

export type ShopState = { error?: string; ok?: string } | undefined;

async function store(site: string): Promise<StoreContext> {
  const s = await getStore(site);
  if (!s || s.status !== "active") throw new Error("This store is not available.");
  return s;
}

// ---------- Cart ----------

export async function addToCart(site: string, productId: string, qty = 1): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-01"]) return { error: "The catalog is turned off." };
  if (!Types.ObjectId.isValid(productId)) return { error: "Unknown product." };
  const m = await storeModels(s);
  const p = await m.Product.findOne({ _id: productId, status: "active" }).lean();
  if (!p) return { error: "That product is no longer available." };
  const cart = (await findCart(s, true))!;
  const ex = cart.items.find((i) => String(i.product) === productId);
  const want = (ex?.qty ?? 0) + Math.max(1, Math.min(99, Math.floor(qty)));
  if (s.features["F-17"] && want > p.stock)
    return { error: p.stock > 0 ? `Only ${p.stock} left in stock.` : "Sorry, this is out of stock." };
  if (ex) ex.qty = want;
  else cart.items.push({ product: p._id, name: p.name, price: p.price, qty: want });
  await cart.save();
  revalidatePath(`/s/${s.subdomain}`, "layout");
  return { ok: `Added ${p.name} to your cart.` };
}

export async function setCartQty(site: string, productId: string, qty: number) {
  const s = await store(site);
  const cart = await findCart(s);
  if (!cart) return;
  const it = cart.items.find((i) => String(i.product) === productId);
  if (!it) return;
  if (qty <= 0) cart.items = cart.items.filter((i) => String(i.product) !== productId);
  else it.qty = Math.min(999, Math.floor(qty));
  await cart.save();
  revalidatePath(`/s/${s.subdomain}`, "layout");
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
    revalidatePath(`/s/${s.subdomain}`, "layout");
    return { ok: "Code removed." };
  }
  const d = await evaluateDiscount(s, code, view.subtotal);
  if (d.error) return { error: d.error };
  cart!.discountCode = d.code;
  await cart!.save();
  revalidatePath(`/s/${s.subdomain}`, "layout");
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
});

export async function placeOrder(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const user = await getCurrentUser(s);
  const customer = user?.role === "customer" ? user : null;
  if (!customer && !s.features["F-19"])
    return { error: "Please sign in or create an account to check out." };
  if (d.delivery === "shipping" && (!d.address || !d.city))
    return { error: "Enter your delivery address and city." };
  if (d.delivery === "pickup" && !s.features["F-59"]) return { error: "Pickup isn't available in this store." };
  if (d.payment === "cod" && !s.features["F-23"]) return { error: "Cash on delivery isn't available. Choose another payment method." };
  if (d.payment !== "cod")
    return { error: "Online payment isn't set up for this store yet. Please choose cash on delivery." };

  const cart = await findCart(s);
  const view = await viewCart(s);
  if (!cart || !view.items.length) return { error: "Your cart is empty." };
  const disc = await evaluateDiscount(s, view.discountCode, view.subtotal);
  const price = priceOrder(s, view.subtotal, disc.amount, d.delivery);
  const m = await storeModels(s);

  // F-17 / F-101: reserve stock atomically; roll back if any item is short.
  const reserved: { id: string; qty: number }[] = [];
  if (s.features["F-17"]) {
    for (const it of view.items) {
      const r = await m.Product.updateOne({ _id: it.product, stock: { $gte: it.qty } }, { $inc: { stock: -it.qty } });
      if (r.modifiedCount !== 1) {
        for (const x of reserved) await m.Product.updateOne({ _id: x.id }, { $inc: { stock: x.qty } });
        return { error: `Sorry, there isn't enough stock of ${it.name}. Lower the quantity and try again.` };
      }
      reserved.push({ id: it.product, qty: it.qty });
    }
  }
  if (disc.code) await m.Discount.updateOne({ code: disc.code }, { $inc: { used: 1 } });

  const number = await nextOrderNumber(m);
  const trackingToken = crypto.randomBytes(16).toString("base64url");
  const order = await m.Order.create({
    number,
    channel: "online",
    user: customer?._id,
    customer: { name: d.name, email: d.email, phone: d.phone, address: d.address, city: d.city },
    delivery: d.delivery,
    items: view.items.map((i) => ({ product: new Types.ObjectId(i.product), name: i.name, price: i.price, qty: i.qty })),
    ...price,
    discountCode: disc.code,
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

  if (s.features["F-41"]) {
    const rows = order.items.map((i) => `<tr><td>${esc(i.name)} × ${i.qty}</td><td align="right">${formatMoney(i.price * i.qty, s.currency)}</td></tr>`).join("");
    await sendEmail(
      m,
      d.email,
      `${s.name}: order #${number} received`,
      `<h2>Thank you, ${esc(d.name)}!</h2><p>We received your order #${number}.</p><table width="100%">${rows}<tr><td><b>Total</b></td><td align="right"><b>${formatMoney(order.total, s.currency)}</b></td></tr></table><p>Payment: cash on delivery.</p>`,
    );
  }
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
  const user = await getCurrentUser(s);
  if (!user) redirect(`${s.base}/account/login`);
  const m = await storeModels(s);
  const o = await m.Order.findOne({ number: orderNumber, user: user._id }).lean();
  if (!o) return;
  for (const it of o.items) await addToCart(site, String(it.product), it.qty).catch(() => {});
  redirect(`${s.base}/cart`);
}

// ---------- Customer accounts (F-22, F-121) ----------

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

export async function register(site: string, _: ShopState, form: FormData): Promise<ShopState> {
  const s = await store(site);
  if (!s.features["F-22"]) return { error: "Accounts aren't available in this store." };
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const m = await storeModels(s);
  if (await m.User.exists({ email: parsed.data.email.toLowerCase() }))
    return { error: "An account with that email already exists. Sign in instead." };
  const u = await m.User.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    role: "customer",
  });
  await createStoreSession(s, String(u._id), "customer");
  redirect(`${s.base}/account`);
}

export async function customerLogin(site: string, _: ShopState, form: FormData): Promise<ShopState> {
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

// ---------- Wishlist (F-10) and reviews (F-04) ----------

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
  revalidatePath(`/s/${s.subdomain}`, "layout");
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
  await m.Review.updateOne(
    { product: productId, user: user._id },
    { $set: { rating, text, name: user.name } },
    { upsert: true },
  );
  const agg = await m.Review.aggregate<{ avg: number; n: number }>([
    { $match: { product: new Types.ObjectId(productId) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  await m.Product.updateOne({ _id: productId }, { $set: { ratingAvg: agg[0]?.avg ?? 0, ratingCount: agg[0]?.n ?? 0 } });
  revalidatePath(`/s/${s.subdomain}`, "layout");
  return { ok: "Thanks! Your review is posted." };
}
