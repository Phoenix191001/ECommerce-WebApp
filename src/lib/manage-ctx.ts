import "server-only";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { platformDb } from "./db";
import { platformModels } from "./models/platform";
import { getStore, storeModels, type StoreContext } from "./tenant";
import { requireStaff, type Permission } from "./store-auth";

/** Store, signed-in staff member (with permission) and models, for panel actions. */
export async function staffCtx(site: string, perm?: Permission, feature?: string) {
  const store = await getStore(site);
  if (!store) throw new Error("Store not found");
  const user = await requireStaff(store, perm);
  if (feature && !store.features[feature]) throw new Error(`${feature} is turned off.`);
  const m = await storeModels(store);
  return { store, user, m };
}

export const actorOf = (u: { email: string; imp?: string }) => (u.imp ? `${u.imp} (as ${u.email})` : u.email);

export async function auditLog(store: StoreContext, actor: string, action: string, target?: string, oldValue?: unknown, newValue?: unknown) {
  const { AuditLog } = platformModels(await platformDb());
  await AuditLog.create({ instance: new Types.ObjectId(store.id), actor, actorRole: "store_owner", action, target, oldValue, newValue });
}

export const refreshStore = (store: StoreContext) => revalidatePath(`/s/${store.subdomain}`, "layout");

/** Save part of the store settings (instance.settings.<key>). */
export async function saveStoreSettings(store: StoreContext, patch: Record<string, unknown>) {
  const { Instance } = platformModels(await platformDb());
  await Instance.updateOne({ _id: store.id }, { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`settings.${k}`, v])) });
}
