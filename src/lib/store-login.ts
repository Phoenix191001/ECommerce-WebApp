import "server-only";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { storeModels, type StoreContext } from "./tenant";
import type { StoreRole } from "./models/tenant";
import { LOCK_AFTER, LOCK_MINUTES, createStoreSession } from "./store-auth";

/** Shared sign-in with lockout after repeated failures (F-121). */
export async function loginAs(s: StoreContext, form: FormData, roles: StoreRole[], to: string): Promise<{ error?: string } | undefined> {
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
  u.failedLogins = 0;
  u.lockUntil = undefined;
  await u.save();
  await createStoreSession(s, String(u._id), u.role);
  redirect(to);
}

