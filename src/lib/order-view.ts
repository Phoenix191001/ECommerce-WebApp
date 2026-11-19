import "server-only";
import crypto from "node:crypto";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";
import { getCurrentUser, isStaff } from "./store-auth";

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** An order is visible with its tracking token, to the customer who placed it, or to staff. */
export async function loadOrderForViewer(store: StoreContext, number: number, token?: string) {
  if (!Number.isFinite(number)) return null;
  const m = await storeModels(store);
  const o = await m.Order.findOne({ number }).lean();
  if (!o) return null;
  if (token && safeEq(token, o.trackingToken)) return o;
  const u = await getCurrentUser(store);
  if (u && (isStaff(u.role) || (o.user && String(o.user) === String(u._id)))) return o;
  return null;
}

export const STATUS_STEPS = ["pending", "confirmed", "shipped", "delivered"] as const;
export const STATUS_LABEL: Record<string, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  shipped: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** F-12: downloads unlock once the store confirms the order (and stay locked if it's cancelled or refunded). */
export const canDownload = (o: { status: string; paymentStatus: string }) =>
  ["confirmed", "shipped", "delivered"].includes(o.status) && o.paymentStatus !== "refunded";
