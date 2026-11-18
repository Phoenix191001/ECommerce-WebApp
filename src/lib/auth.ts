import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "sa_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours
const PENDING_AGE = 60 * 10; // 10 minutes to finish two-factor

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  return new TextEncoder().encode(s);
}

/** mfa=false is a half-signed-in state: password checked, two-factor still needed (FR-A-08). */
export async function createAdminSession(email: string, mfa: boolean) {
  const age = mfa ? MAX_AGE : PENDING_AGE;
  const token = await new SignJWT({ role: "super_admin", mfa })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${age}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: age,
  });
}

export async function destroyAdminSession() {
  (await cookies()).delete(COOKIE);
}

async function readSession(): Promise<{ email: string; mfa: boolean } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "super_admin" || !payload.sub) return null;
    return { email: payload.sub, mfa: payload.mfa === true };
  } catch {
    return null;
  }
}

/** Fully signed-in Super Admin (password + two-factor). */
export async function getAdmin(): Promise<{ email: string } | null> {
  const s = await readSession();
  return s?.mfa ? { email: s.email } : null;
}

/** Password checked, two-factor pending. */
export async function getPendingAdmin(): Promise<{ email: string } | null> {
  const s = await readSession();
  return s && !s.mfa ? { email: s.email } : null;
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
