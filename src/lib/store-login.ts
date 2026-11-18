import "server-only";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { storeModels, type StoreContext } from "./tenant";
import type { StoreRole } from "./models/tenant";
import { LOCK_AFTER, LOCK_MINUTES, createStoreSession } from "./store-auth";
import { verifyTotp } from "./totp";

export type LoginResult = { error?: string; needCode?: boolean } | undefined;

/** Shared sign-in with lockout after repeated failures (F-121). */
export async function loginAs(s: StoreContext, form: FormData, roles: StoreRole[], to: string): Promise<LoginResult> {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const m = await storeModels(s);
  const u = await m.User.findOne({ email, role: { $in: roles } });
  const lockOn = s.features["F-121"];
  if (lockOn && u?.lockUntil && u.lockUntil > new Date())
    return { error: `Too many failed attempts. Try again after ${u.lockUntil.toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi" })}.` };
  const ok = u?.passwordHash ? await bcrypt.compare(password, u.passwordHash) : false;
  if (!u || !ok) {
    if (u && lockOn) {
      u.failedLogins = (u.failedLogins ?? 0) + 1;
      if (u.failedLogins >= LOCK_AFTER) {
        u.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        u.failedLogins = 0;
      }
      await u.save();
    }
    return { error: "Email or password is incorrect." };
  }
  // F-69: customers who turned on two-factor must also give a current code.
  if (u.role === "customer" && s.features["F-69"] && u.totpEnabled && u.totpSecret) {
    const code = String(form.get("code") ?? "");
    if (!code) return { error: "Enter the 6-digit code from your authenticator app.", needCode: true };
    if (!verifyTotp(u.totpSecret, code, u.email)) return { error: "That code didn't match. Enter the newest code.", needCode: true };
  }
  u.failedLogins = 0;
  u.lockUntil = undefined;
  await u.save();
  await createStoreSession(s, String(u._id), u.role);
  redirect(to);
}

