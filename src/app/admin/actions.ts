"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { platformDb, instanceDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { tenantModels } from "@/lib/models/tenant";
import { createAdminSession, destroyAdminSession, requireAdmin } from "@/lib/auth";
import { validateSubdomain } from "@/lib/subdomain";
import { FEATURE_MAP, defaultToggles, missingPrereqs, type ToggleState } from "@/lib/features";

export type FormState = { error?: string; ok?: string } | undefined;

const models = async () => platformModels(await platformDb());

// ---------- Auth ----------

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
  await SuperAdmin.create({ email: parsed.data.email, passwordHash });
  await createAdminSession(parsed.data.email);
  redirect("/admin");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const { SuperAdmin } = await models();
  const admin = await SuperAdmin.findOne({ email }).lean();
  const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (!ok) return { error: "Email or password is incorrect. Check both and try again." };
  await createAdminSession(email);
  redirect("/admin");
}

export async function logout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ---------- Instances ----------

const newInstance = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters.").max(80),
  subdomain: z.string(),
  planId: z.string().refine((v) => Types.ObjectId.isValid(v), "Choose a plan."),
  ownerName: z.string().trim().min(2, "Enter the owner's name."),
  ownerEmail: z.email("Enter a valid owner email address."),
});

/** FR-A-01 */
export async function createInstance(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = newInstance.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const sub = validateSubdomain(d.subdomain);
  if (!sub.ok) return { error: sub.error };

  const { Plan, Instance, AuditLog } = await models();
  const plan = await Plan.findById(d.planId).lean();
  if (!plan) return { error: "That plan no longer exists. Reload the page and pick another." };
  if (await Instance.exists({ subdomain: sub.value }))
    return { error: `"${sub.value}" is already taken. Choose a different subdomain.` };

  const inst = await Instance.create({
    name: d.name,
    subdomain: sub.value,
    plan: plan._id,
    owner: { name: d.ownerName, email: d.ownerEmail },
    toggles: defaultToggles(plan.features),
  });
  await AuditLog.create({
    instance: inst._id,
    actor: admin.email,
    actorRole: "super_admin",
    action: "instance.create",
    newValue: { subdomain: sub.value, plan: plan.name },
  });
  revalidatePath("/admin");
  redirect(`/admin/instances/${inst._id}`);
}

async function loadInstance(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid instance id");
  const m = await models();
  const inst = await m.Instance.findById(id);
  if (!inst) throw new Error("Instance not found");
  return { ...m, inst };
}

/** FR-A-02, FR-A-03, FR-A-07 */
export async function setToggle(
  instanceId: string,
  featureId: string,
  on: boolean,
): Promise<{ error?: string; missing?: string[] }> {
  const admin = await requireAdmin();
  const feature = FEATURE_MAP[featureId];
  if (!feature) return { error: `Unknown feature ${featureId}.` };

  const { inst, Plan, AuditLog } = await loadInstance(instanceId);
  const plan = await Plan.findById(inst.plan).lean();
  const state = Object.fromEntries(inst.toggles ?? new Map()) as ToggleState;

  if (on) {
    if (plan && !plan.features.includes(featureId))
      return { error: `${featureId} is not part of the ${plan.name} plan. Change the plan or add it to the plan first.` };
    const missing = missingPrereqs(featureId, state);
    if (missing.length)
      return { error: `Turn on ${missing.join(", ")} first — ${featureId} depends on ${missing.length > 1 ? "them" : "it"}.`, missing };
  }

  const old = !!state[featureId];
  if (old === on) return {};
  inst.toggles.set(featureId, on);
  await inst.save();
  await AuditLog.create({
    instance: inst._id,
    actor: admin.email,
    actorRole: "super_admin",
    action: "toggle.set",
    target: featureId,
    oldValue: old,
    newValue: on,
  });
  revalidatePath(`/admin/instances/${instanceId}`);
  revalidatePath(`/s/${inst.subdomain}`, "layout");
  return {};
}

/** AC-02 */
export async function setToggleLock(instanceId: string, featureId: string, locked: boolean) {
  const admin = await requireAdmin();
  if (!FEATURE_MAP[featureId]) return;
  const { inst, AuditLog } = await loadInstance(instanceId);
  const set = new Set(inst.lockedToggles);
  if (locked) set.add(featureId);
  else set.delete(featureId);
  inst.lockedToggles = [...set];
  await inst.save();
  await AuditLog.create({
    instance: inst._id,
    actor: admin.email,
    actorRole: "super_admin",
    action: locked ? "toggle.lock" : "toggle.unlock",
    target: featureId,
  });
  revalidatePath(`/admin/instances/${instanceId}`);
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
    instance: inst._id,
    actor: admin.email,
    actorRole: "super_admin",
    action: "instance.status",
    oldValue: old,
    newValue: status,
  });
  revalidatePath(`/admin/instances/${instanceId}`);
  revalidatePath("/admin");
  revalidatePath(`/s/${inst.subdomain}`, "layout");
}

// ---------- Instance data (AC-01) ----------

const newProduct = z.object({
  name: z.string().trim().min(1, "Enter a product name.").max(200),
  price: z.coerce.number().min(0, "Price can't be negative."),
  stock: z.coerce.number().int().min(0).default(0),
  description: z.string().trim().max(5000).optional(),
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
    return { error: `This store has reached its plan limit of ${max} products. Upgrade the plan or raise the limit.` };

  let slug = slugify(parsed.data.name);
  if (await Product.exists({ slug })) slug = `${slug}-${Date.now().toString(36)}`;
  await Product.create({ ...parsed.data, slug });
  await AuditLog.create({
    instance: inst._id,
    actor: admin.email,
    actorRole: "super_admin",
    action: "product.create",
    target: slug,
  });
  revalidatePath(`/admin/instances/${instanceId}`);
  revalidatePath(`/s/${inst.subdomain}`, "layout");
  return { ok: `Added "${parsed.data.name}".` };
}
