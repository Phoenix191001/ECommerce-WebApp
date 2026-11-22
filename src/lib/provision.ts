import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { after } from "next/server";
import { Types } from "mongoose";
import { platformDb, instanceDb } from "./db";
import { ensurePlatformIndexes, platformModels } from "./models/platform";
import { ensureTenantIndexes, tenantModels } from "./models/tenant";
import { validateSubdomain } from "./subdomain";
import { defaultToggles } from "./features";

const models = async () => platformModels(await platformDb());

export const newInstanceSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters.").max(80),
  subdomain: z.string(),
  planId: z.string().refine((v) => Types.ObjectId.isValid(v), "Choose a plan."),
  ownerName: z.string().trim().min(2, "Enter the owner's name."),
  ownerEmail: z.email("Enter a valid owner email address."),
});

let platformIndexes: Promise<unknown> | undefined;

/** Shared by the Super Admin form and self-serve signup (FR-A-01, FR-S-02). */
export async function provisionInstance(d: z.infer<typeof newInstanceSchema>, actor: { email: string; role: "super_admin" | "system" }) {
  const sub = validateSubdomain(d.subdomain);
  if (!sub.ok) return { error: sub.error };
  const conn = await platformDb();
  // Platform indexes already exist after the first store; check them once per server instance.
  platformIndexes ??= Promise.resolve(ensurePlatformIndexes(conn)).catch((e) => { platformIndexes = undefined; throw e; });
  await platformIndexes;
  const { Plan, Instance, AuditLog } = platformModels(conn);
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
    branding: { primaryColor: "#4f46e5", tagline: "" },
  });
  const m = tenantModels(await instanceDb(String(inst._id)));
  // Only the owner account needs its index (unique email) before the owner can sign in. The rest of the
  // new store's indexes are built after the response, so creating a store doesn't wait for ~40 of them.
  await m.User.createIndexes();
  after(() => ensureTenantIndexes(m).catch((e) => console.error("tenant indexes", String(inst._id), e)));
  await m.User.create({ email: d.ownerEmail, name: d.ownerName, role: "owner" });
  await AuditLog.create({
    instance: inst._id,
    actor: actor.email,
    actorRole: actor.role,
    action: "instance.create",
    newValue: { subdomain: sub.value, plan: plan.name },
  });
  return { id: String(inst._id), subdomain: sub.value };
}

/** One-time link the owner opens to set their password (valid 7 days). */
export async function issueOwnerSetupLink(instanceId: string): Promise<string> {
  const { Instance } = await models();
  const inst = await Instance.findById(instanceId).lean();
  if (!inst) throw new Error("Store not found");
  const m = tenantModels(await instanceDb(instanceId));
  const token = crypto.randomBytes(24).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  let owner = await m.User.findOne({ role: "owner" });
  if (!owner) owner = await m.User.create({ email: inst.owner.email, name: inst.owner.name, role: "owner" });
  owner.setupTokenHash = hash;
  owner.setupTokenExpires = new Date(Date.now() + 7 * 24 * 3600_000);
  await owner.save();
  return `/s/${inst.subdomain}/manage/setup?token=${token}`;
}

