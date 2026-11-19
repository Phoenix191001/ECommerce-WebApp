import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { Types } from "mongoose";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";
import type { StoreRole, User } from "./models/tenant";

const MAX_AGE = 60 * 60 * 24 * 14;
const cookieName = (storeId: string) => `ss_${storeId}`;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return new TextEncoder().encode(s);
}

export type StoreSession = { uid: string; role: StoreRole; imp?: string };

export async function createStoreSession(store: StoreContext, uid: string, role: StoreRole, imp?: string) {
  const token = await new SignJWT({ role, store: store.id, ...(imp ? { imp } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime(`${imp ? 60 * 60 : MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(cookieName(store.id), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: imp ? 60 * 60 : MAX_AGE,
  });
}

export async function destroyStoreSession(store: StoreContext) {
  (await cookies()).delete(cookieName(store.id));
}

export async function getStoreSession(store: StoreContext): Promise<StoreSession | null> {
  const token = (await cookies()).get(cookieName(store.id))?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.store !== store.id || !payload.sub || !Types.ObjectId.isValid(payload.sub)) return null;
    return { uid: payload.sub, role: payload.role as StoreRole, imp: payload.imp as string | undefined };
  } catch {
    return null;
  }
}

export type CurrentUser = User & { _id: Types.ObjectId; imp?: string };

export async function getCurrentUser(store: StoreContext): Promise<CurrentUser | null> {
  const s = await getStoreSession(store);
  if (!s) return null;
  const { User: U } = await storeModels(store);
  const u = await U.findById(s.uid).lean();
  if (!u) return null;
  return { ...(u as User & { _id: Types.ObjectId }), imp: s.imp };
}

// SRS 4.3 role-based access
export type Permission =
  | "features" | "staff" | "catalog" | "orders" | "discounts" | "pos" | "reports" | "settings" | "customers";

const ROLE_PERMS: Record<StoreRole, Permission[]> = {
  owner: ["features", "staff", "catalog", "orders", "discounts", "pos", "reports", "settings", "customers"],
  manager: ["staff", "catalog", "orders", "discounts", "pos", "reports", "customers"],
  cashier: ["pos"],
  seller: ["catalog", "orders"], // F-67: marketplace sellers see only their own products and order lines
  customer: [],
};

export const can = (role: StoreRole | undefined, p: Permission) => !!role && ROLE_PERMS[role].includes(p);
export const isStaff = (role?: StoreRole) => role === "owner" || role === "manager" || role === "cashier" || role === "seller";

/** Gate a staff page or action. Redirects to the staff sign-in page when signed out. */
export async function requireStaff(store: StoreContext, perm?: Permission, opts?: { seller?: boolean }): Promise<CurrentUser> {
  const user = await getCurrentUser(store);
  if (!user || !isStaff(user.role)) redirect(`${store.base}/manage/login`);
  // F-67: marketplace sellers only reach the pages and actions that opt in (their products, orders and earnings).
  if (user.role === "seller" && (!store.features["F-67"] || (perm && !opts?.seller))) redirect(`${store.base}/manage/products`);
  if (perm && !can(user.role, perm)) redirect(`${store.base}/manage`);
  return user;
}

/** Login rate limiting and lockout (F-121): 5 failures lock the account for 15 minutes. */
export const LOCK_AFTER = 5;
export const LOCK_MINUTES = 15;
