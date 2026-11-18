"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { platformDb, instanceDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { tenantModels } from "@/lib/models/tenant";
import { createAdminSession, destroyAdminSession, getPendingAdmin, requireAdmin } from "@/lib/auth";
import { newTotpSecret, verifyTotp } from "@/lib/totp";
import { ALL_FEATURE_IDS, FEATURE_MAP } from "@/lib/features";
import { issueOwnerSetupLink, newInstanceSchema, provisionInstance } from "@/lib/provision";
import { applyStarterPack, applyToggle, type ToggleResult } from "@/lib/toggles";
import { createStoreSession } from "@/lib/store-auth";
import { getStore } from "@/lib/tenant";
import { removeProjectDomain } from "@/lib/vercel-domains";

export type FormState = { error?: string; ok?: string; link?: string } | undefined;

const models = async () => platformModels(await platformDb());
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

// ---------- Auth (FR-A-08: password + two-factor) ----------

const credentials = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(10, "Password must be at least 10 characters."),
});

/** First-run setup: create the Super Admin. Works only while none exists. */
export async function setupAdmin(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { SuperAdmin } = await models();
  if ((await SuperAdmin.estimatedDocumentCount()) > 0)
    return { error: "A Super Admin already exists. Sign in instead." };
  const passwordHash = await bcrypt.hash(parsed.data.password, 12); // NFR-02
  await SuperAdmin.create({ email: parsed.data.email, passwordHash, totpSecret: newTotpSecret() });
  await createAdminSession(parsed.data.email, false);
  redirect("/admin/2fa");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const { SuperAdmin } = await models();
  const admin = await SuperAdmin.findOne({ email });
  if (admin?.lockUntil && admin.lockUntil > new Date())
    return { error: `Too many failed attempts. Try again after ${admin.lockUntil.toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi" })}.` };
  const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (!admin || !ok) {
    if (admin) {
      admin.failedLogins = (admin.failedLogins ?? 0) + 1;
      if (admin.failedLogins >= LOCK_AFTER) {
        admin.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        admin.failedLogins = 0;
      }
      await admin.save();
    }
    return { error: "Email or password is incorrect. Check both and try again." };
  }
  if (!admin.totpSecret) admin.totpSecret = newTotpSecret();
  admin.failedLogins = 0;
  admin.lockUntil = undefined;
  await admin.save();
  await createAdminSession(email, false);
  redirect("/admin/2fa");
}

export async function verifyTwoFactor(_: FormState, form: FormData): Promise<FormState> {
  const pending = await getPendingAdmin();
  if (!pending) redirect("/admin/login");
  const { SuperAdmin } = await models();
  const admin = await SuperAdmin.findOne({ email: pending.email });
  if (!admin?.totpSecret) redirect("/admin/login");
  if (!verifyTotp(admin.totpSecret, String(form.get("code") ?? ""), admin.email))
    return { error: "That code didn't match. Check the time on your phone and enter the newest 6-digit code." };
  if (!admin.totpEnabled) {
    admin.totpEnabled = true;
    await admin.save();
  }
  await createAdminSession(admin.email, true);
  redirect("/admin");
}

export async function logout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function dismissChecklist() {
  const admin = await requireAdmin();
  const { SuperAdmin } = await models();
  await SuperAdmin.updateOne({ email: admin.email }, { $set: { checklistDismissed: true } });
  revalidatePath("/admin");
}

// ---------- Instances ----------

export async function createInstance(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = newInstanceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const res = await provisionInstance(parsed.data, { email: admin.email, role: "super_admin" });
  if ("error" in res) return { error: res.error };
  redirect(`/admin/instances/${res.id}?created=1`);
}

export async function createOwnerLink(instanceId: string): Promise<FormState> {
  const admin = await requireAdmin();
  const path = await issueOwnerSetupLink(instanceId);
  const { AuditLog } = await models();
  await AuditLog.create({ instance: new Types.ObjectId(instanceId), actor: admin.email, actorRole: "super_admin", action: "owner.setup_link" });
  return { ok: "Setup link created. It works once and expires in 7 days.", link: path };
}

export async function setToggle(instanceId: string, featureId: string, on: boolean, withPrereqs = false): Promise<ToggleResult> {
  const admin = await requireAdmin();
  const res = await applyToggle(instanceId, featureId, on, { email: admin.email, role: "super_admin" }, withPrereqs);
  revalidatePath(`/admin/instances/${instanceId}`);
  return res;
}

export async function starterPack(instanceId: string) {
  const admin = await requireAdmin();
  await applyStarterPack(instanceId, { email: admin.email, role: "super_admin" });
  revalidatePath(`/admin/instances/${instanceId}`);
}

async function loadInstance(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid instance id");
  const m = await models();
  const inst = await m.Instance.findById(id);
  if (!inst) throw new Error("Instance not found");
  return { ...m, inst };
}

/** AC-02 */
export async function setToggleLock(instanceId: string, featureId: string, locked: boolean) {
  const admin = await requireAdmin();
  if (!FEATURE_MAP[featureId]) return {};
  const { inst, AuditLog } = await loadInstance(instanceId);
  const set = new Set(inst.lockedToggles);
  if (locked) set.add(featureId);
  else set.delete(featureId);
  inst.lockedToggles = [...set];
  await inst.save();
  await AuditLog.create({
    instance: inst._id, actor: admin.email, actorRole: "super_admin",
    action: locked ? "toggle.lock" : "toggle.unlock", target: featureId,
  });
  revalidatePath(`/admin/instances/${instanceId}`);
  return {};
}

/** FR-A-05 */
export async function setInstanceStatus(instanceId: string, status: "active" | "suspended") {
  const admin = await requireAdmin();
  const { inst, AuditLog } = await loadInstance(instanceId);
  const old = inst.status;
  if (old === status) return;
  inst.status = status;
  await inst.save();
  await AuditLog.create({
    instance: inst._id, actor: admin.email, actorRole: "super_admin",
    action: "instance.status", oldValue: old, newValue: status,
  });
  revalidatePath(`/admin/instances/${instanceId}`);
  revalidatePath("/admin");
}

export async function changePlan(instanceId: string, form: FormData) {
  const admin = await requireAdmin();
  const planId = String(form.get("planId") ?? "");
  const { inst, Plan, AuditLog } = await loadInstance(instanceId);
  const plan = Types.ObjectId.isValid(planId) ? await Plan.findById(planId).lean() : null;
  if (!plan) return;
  const old = String(inst.plan);
  inst.plan = plan._id;
  // Features outside the new plan are switched off; their data is kept.
  for (const [id, on] of inst.toggles) if (on && !plan.features.includes(id)) inst.toggles.set(id, false);
  await inst.save();
  await AuditLog.create({
    instance: inst._id, actor: admin.email, actorRole: "super_admin",
    action: "instance.plan", oldValue: old, newValue: plan.name,
  });
  revalidatePath(`/admin/instances/${instanceId}`);
}

/** AC-03 */
export async function setLimits(instanceId: string, form: FormData) {
  const admin = await requireAdmin();
  const { inst, AuditLog } = await loadInstance(instanceId);
  const num = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" ? undefined : Math.max(0, Math.floor(Number(v)) || 0);
  };
  const next = { maxProducts: num("maxProducts"), maxStaff: num("maxStaff"), maxDomains: num("maxDomains") };
  inst.limitOverrides = next;
  await inst.save();
  await AuditLog.create({ instance: inst._id, actor: admin.email, actorRole: "super_admin", action: "instance.limits", newValue: next });
  revalidatePath(`/admin/instances/${instanceId}`);
}

/** AC-04: sign in as the Store Owner, with a banner and an audit entry. */
export async function impersonateOwner(instanceId: string) {
  const admin = await requireAdmin();
  const { inst, AuditLog } = await loadInstance(instanceId);
  const store = await getStore(inst.subdomain);
  if (!store) throw new Error("Store not found");
  const m = tenantModels(await instanceDb(instanceId));
  let owner = await m.User.findOne({ role: "owner" }).lean();
  if (!owner) owner = (await m.User.create({ email: inst.owner.email, name: inst.owner.name, role: "owner" })).toObject();
  await createStoreSession(store, String(owner._id), "owner", admin.email);
  await AuditLog.create({ instance: inst._id, actor: admin.email, actorRole: "super_admin", action: "owner.impersonate" });
  redirect(`/s/${inst.subdomain}/manage`);
}

/** FR-A-09: typed confirmation, and a data export in the last 24 hours. */
export async function deleteInstance(instanceId: string, _: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const { inst, AuditLog, Instance } = await loadInstance(instanceId);
  if (String(form.get("confirm") ?? "").trim() !== inst.subdomain)
    return { error: `Type "${inst.subdomain}" exactly to confirm.` };
  if (!inst.exportedAt || Date.now() - inst.exportedAt.getTime() > 24 * 3600_000)
    return { error: "Download the data export first (button above). Deletion is allowed for 24 hours after an export." };
  if (inst.customDomain) await removeProjectDomain(inst.customDomain).catch(() => {});
  // The app's database user can drop collections but not whole databases;
  // an empty database disappears once its last collection is dropped.
  const db = (await instanceDb(instanceId)).db!;
  for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) await db.dropCollection(c.name);
  await Instance.deleteOne({ _id: inst._id });
  await AuditLog.create({ instance: inst._id, actor: admin.email, actorRole: "super_admin", action: "instance.delete", oldValue: inst.subdomain });
  redirect("/admin");
}

// ---------- Plans (FR-A-04) ----------

export async function savePlan(planId: string | null, _: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Give the plan a name." };
  const features = form.getAll("features").map(String).filter((f) => ALL_FEATURE_IDS.includes(f));
  const n = (k: string) => Math.max(0, Math.floor(Number(form.get(k) ?? 0)) || 0);
  const doc = {
    name,
    description: String(form.get("description") ?? "").trim(),
    priceMonthly: n("priceMonthly"),
    features,
    maxProducts: n("maxProducts"),
    maxStaff: n("maxStaff"),
    maxDomains: n("maxDomains"),
    requiresActivation: form.get("requiresActivation") === "1",
  };
  const { Plan, AuditLog } = await models();
  try {
    if (planId) await Plan.updateOne({ _id: planId }, { $set: doc });
    else await Plan.create(doc);
  } catch {
    return { error: "A plan with that name already exists." };
  }
  await AuditLog.create({ actor: admin.email, actorRole: "super_admin", action: planId ? "plan.update" : "plan.create", target: name });
  revalidatePath("/admin/plans");
  return { ok: `Saved ${name} with ${features.length} features.` };
}

// ---------- Instance data (AC-01) ----------

const newProduct = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(200),
  price: z.coerce.number().min(0, "Price can't be negative."),
  stock: z.coerce.number().int().min(0).default(0),
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "product";

export async function addProduct(instanceId: string, _: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = newProduct.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { inst, Plan, AuditLog } = await loadInstance(instanceId);
  const { Product } = tenantModels(await instanceDb(String(inst._id)));
  const plan = await Plan.findById(inst.plan).lean();
  const max = inst.limitOverrides?.maxProducts ?? plan?.maxProducts ?? 0;
  if (max > 0 && (await Product.countDocuments()) >= max)
    return { error: `This store has reached its limit of ${max} products. Upgrade the plan or raise the limit.` };
  let slug = slugify(parsed.data.name);
  if (await Product.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
  await Product.create({ ...parsed.data, slug });
  await AuditLog.create({ instance: inst._id, actor: admin.email, actorRole: "super_admin", action: "product.create", target: slug });
  revalidatePath(`/admin/instances/${instanceId}`);
  return { ok: `Added "${parsed.data.name}".` };
}
