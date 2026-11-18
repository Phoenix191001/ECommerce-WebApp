import "server-only";
import { cache } from "react";
import { platformDb, instanceDb } from "./db";
import { platformModels } from "./models/platform";
import { tenantModels } from "./models/tenant";
import { effectiveToggles, type ToggleState } from "./features";

export type StoreContext = {
  id: string;
  name: string;
  subdomain: string;
  status: "active" | "suspended";
  currency: string;
  branding: { primaryColor: string; tagline: string; logoUrl?: string | null };
  features: ToggleState; // effective state, read from one place (NFR-14)
};

/** Resolve the instance for a subdomain. Cached per request. */
export const getStore = cache(async (subdomain: string): Promise<StoreContext | null> => {
  const { Instance } = platformModels(await platformDb());
  const inst = await Instance.findOne({ subdomain: subdomain.toLowerCase() }).lean();
  if (!inst) return null;
  const raw = Object.fromEntries(Object.entries(inst.toggles ?? {})) as ToggleState;
  return {
    id: String(inst._id),
    name: inst.name,
    subdomain: inst.subdomain,
    status: inst.status as StoreContext["status"],
    currency: inst.currency ?? "PKR",
    branding: {
      primaryColor: inst.branding?.primaryColor ?? "#111827",
      tagline: inst.branding?.tagline ?? "",
      logoUrl: inst.branding?.logoUrl,
    },
    features: effectiveToggles(raw),
  };
});

export async function storeModels(store: Pick<StoreContext, "id">) {
  return tenantModels(await instanceDb(store.id));
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
