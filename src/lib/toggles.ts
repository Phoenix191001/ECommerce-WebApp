import "server-only";
import { Types } from "mongoose";
import { platformDb } from "./db";
import { platformModels } from "./models/platform";
import { FEATURE_MAP, STARTER_PACK, enableChain, missingPrereqs, type ToggleState } from "./features";

export type Actor = { email: string; role: "super_admin" | "store_owner" };
export type ToggleResult = { error?: string; missing?: string[]; changed?: string[] };

/**
 * Turn a feature on or off for an instance (FR-A-02, FR-A-03, FR-A-07, AC-02).
 * Store owners are limited to their plan and can't touch locked toggles; the Super Admin
 * can override the plan only for features the plan includes (plans are edited separately).
 * With `withPrereqs`, missing prerequisites are turned on first (UX-03 one-click turn-on).
 */
export async function applyToggle(
  instanceId: string,
  featureId: string,
  on: boolean,
  actor: Actor,
  withPrereqs = false,
): Promise<ToggleResult> {
  if (!Types.ObjectId.isValid(instanceId)) return { error: "Unknown store." };
  if (!FEATURE_MAP[featureId]) return { error: `Unknown feature ${featureId}.` };
  const { Instance, Plan, AuditLog } = platformModels(await platformDb());
  const inst = await Instance.findById(instanceId);
  if (!inst) return { error: "Store not found." };
  const plan = await Plan.findById(inst.plan).lean();
  const inPlan = new Set(plan?.features ?? []);
  const locked = new Set(inst.lockedToggles ?? []);
  const state = Object.fromEntries(inst.toggles ?? new Map()) as ToggleState;

  const ids = on ? (withPrereqs ? enableChain(featureId, state) : [featureId]) : [featureId];
  if (on && !withPrereqs) {
    const missing = missingPrereqs(featureId, state);
    if (missing.length)
      return {
        error: `${featureId} needs ${missing.join(", ")} turned on first.`,
        missing,
      };
  }
  for (const id of ids) {
    if (on && !inPlan.has(id))
      return { error: `${id} (${FEATURE_MAP[id].name}) isn't included in the ${plan?.name ?? "current"} plan. ${actor.role === "store_owner" ? "Upgrade your plan to use it." : "Add it to the plan on the Plans page first."}` };
    if (actor.role === "store_owner" && locked.has(id))
      return { error: `${id} (${FEATURE_MAP[id].name}) is locked by the platform admin. Contact support to change it.` };
  }

  const changed: string[] = [];
  for (const id of ids) {
    const old = !!state[id];
    if (old === on) continue;
    inst.toggles.set(id, on);
    state[id] = on;
    changed.push(id);
    await AuditLog.create({
      instance: inst._id,
      actor: actor.email,
      actorRole: actor.role,
      action: "toggle.set",
      target: id,
      oldValue: old,
      newValue: on,
    });
  }
  if (changed.length) await inst.save();
  return { changed };
}

/** Turn on every starter-pack feature the plan includes (and isn't locked for owners). */
export async function applyStarterPack(instanceId: string, actor: Actor): Promise<ToggleResult> {
  const { Instance, Plan, AuditLog } = platformModels(await platformDb());
  const inst = await Instance.findById(instanceId);
  if (!inst) return { error: "Store not found." };
  const plan = await Plan.findById(inst.plan).lean();
  const inPlan = new Set(plan?.features ?? []);
  const locked = new Set(inst.lockedToggles ?? []);
  const changed: string[] = [];
  for (const id of STARTER_PACK) {
    if (!inPlan.has(id) || inst.toggles.get(id)) continue;
    if (actor.role === "store_owner" && locked.has(id)) continue;
    inst.toggles.set(id, true);
    changed.push(id);
  }
  if (changed.length) {
    await inst.save();
    await AuditLog.create({
      instance: inst._id, actor: actor.email, actorRole: actor.role,
      action: "toggle.starter_pack", newValue: changed,
    });
  }
  return { changed };
}
