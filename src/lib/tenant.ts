import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { platformDb, instanceDb } from "./db";
import { platformModels, type StoreSettings } from "./models/platform";
import { tenantModels } from "./models/tenant";
import { effectiveToggles, type ToggleState } from "./features";

export type StoreContext = {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  status: "active" | "suspended";
  currency: string;
  branding: { primaryColor: string; tagline: string; logoUrl?: string | null; theme?: Record<string, unknown> | null };
  settings: StoreSettings;
  toggles: ToggleState; // raw switch positions
  features: ToggleState; // effective state, read from one place (NFR-14)
  planFeatures: string[];
  planName: string;
  locked: string[];
  onboarding: { done: string[]; dismissed: boolean };
  /** URL prefix for store links: "" on a store host, "/s/<sub>" on the platform host. */
  base: string;
};

const DEFAULT_SETTINGS: StoreSettings = {
  shippingFlat: 200,
  freeShippingThreshold: 5000,
  taxRate: 0,
  whatsapp: "",
  announcement: "",
  pickupAddress: "",
  contactEmail: "",
  seoTitle: "",
  seoDescription: "",
  lowStockAt: 5,
  giftWrapFee: 150,
  deliverySlots: ["Morning (9am–12pm)", "Afternoon (12pm–4pm)", "Evening (4pm–8pm)"],
  ntn: "",
  gstNumber: "",
  gaId: "",
  pixelId: "",
  pointsPer: 100,
  pointValue: 1,
  referralReward: 200,
  refundApprovalAbove: 10000,
  exitOfferCode: "",
  customCss: "",
  menu: [],
  locations: [],
  currencies: [],
  birthdayPoints: 200,
  anniversaryPoints: 100,
  homePage: "",
  apps: [],
  chatGreeting: "Hi! 👋 How can we help?",
  affiliateRate: 10,
  sellerRate: 10,
  languages: ["en", "ur"],
  defaultLang: "en",
};

/** Resolve an instance by subdomain, or by custom domain when `site` contains a dot. Cached per request. */
export const getStore = cache(async (site: string): Promise<StoreContext | null> => {
  const key = decodeURIComponent(site).toLowerCase();
  const { Instance, Plan } = platformModels(await platformDb());
  const inst = await Instance.findOne(key.includes(".") ? { customDomain: key } : { subdomain: key }).lean();
  if (!inst) return null;
  const plan = await Plan.findById(inst.plan).lean();
  const raw = Object.fromEntries(Object.entries(inst.toggles ?? {})) as ToggleState;
  const onStoreHost = (await headers()).get("x-store-host") === "1";
  return {
    id: String(inst._id),
    name: inst.name,
    subdomain: inst.subdomain,
    customDomain: inst.customDomain ?? undefined,
    status: inst.status,
    currency: inst.currency ?? "PKR",
    branding: {
      primaryColor: inst.branding?.primaryColor ?? "#4f46e5",
      tagline: inst.branding?.tagline ?? "",
      logoUrl: inst.branding?.logoUrl,
      theme: inst.branding?.theme ?? null,
    },
    settings: { ...DEFAULT_SETTINGS, ...(inst.settings ?? {}) },
    toggles: raw,
    features: effectiveToggles(raw),
    planFeatures: plan?.features ?? [],
    planName: plan?.name ?? "",
    locked: inst.lockedToggles ?? [],
    onboarding: { done: inst.onboarding?.done ?? [], dismissed: !!inst.onboarding?.dismissed },
    base: onStoreHost ? "" : `/s/${inst.subdomain}`,
  };
});

export async function storeModels(store: Pick<StoreContext, "id">) {
  return tenantModels(await instanceDb(store.id));
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/** Shipping, tax and total for a subtotal (FR-C-03). */
export function priceOrder(
  store: StoreContext,
  subtotal: number,
  discount: number,
  delivery: "shipping" | "pickup" | "none",
) {
  const afterDiscount = Math.max(0, subtotal - discount);
  let shipping = 0;
  if (delivery === "shipping" && store.features["F-29"]) {
    shipping = store.settings.shippingFlat;
    if (store.features["F-58"] && store.settings.freeShippingThreshold > 0 && afterDiscount >= store.settings.freeShippingThreshold)
      shipping = 0;
  }
  const tax = store.features["F-31"] ? Math.round((afterDiscount * store.settings.taxRate) / 100) : 0;
  return { subtotal, discount: Math.min(discount, subtotal), shipping, tax, total: afterDiscount + shipping + tax };
}

/** For pages and layouts under /s/[site]: 404 when the store doesn't exist. */
export async function requireStore(site: string): Promise<StoreContext> {
  const s = await getStore(site);
  if (!s) notFound();
  return s;
}
