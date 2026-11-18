import "server-only";
import { ALL_FEATURE_IDS, IMPLEMENTED, STARTER_PACK } from "./features";
import { platformDb } from "./db";
import { ensurePlatformIndexes, platformModels } from "./models/platform";

// FR-A-04 plan templates. Which plans launch first is an open question in the SRS,
// so these are starting points the Super Admin can edit on the Plans page.
const POS_AND_DOMAINS = ["F-34", "F-35", "F-36", "F-37", "F-38", "F-39", "F-89"];
export const STARTER_PLAN_FEATURES = Array.from(
  new Set([...STARTER_PACK, ...[...IMPLEMENTED].filter((f) => !POS_AND_DOMAINS.includes(f))]),
);

const TEMPLATES = [
  {
    name: "Starter",
    description: "Everything a new online store needs: catalog, cart, cash on delivery, discounts, reviews, and reports.",
    priceMonthly: 0,
    features: STARTER_PLAN_FEATURES,
    maxProducts: 100,
    maxStaff: 2,
    maxDomains: 0,
    requiresActivation: false,
  },
  {
    name: "Pro",
    description: "Every feature in the catalog, including the cashier POS and custom domains.",
    priceMonthly: 0,
    features: ALL_FEATURE_IDS,
    maxProducts: 0,
    maxStaff: 0,
    maxDomains: 3,
    requiresActivation: true,
  },
];

// The first version's Starter description mentioned card payments, which aren't offered.
const OLD_STARTER_DESCRIPTION = "Core online store: catalog, cart, checkout, COD and card payments.";

export async function ensurePlans() {
  const conn = await platformDb();
  await ensurePlatformIndexes(conn);
  const { Plan } = platformModels(conn);
  if ((await Plan.estimatedDocumentCount()) === 0) {
    await Plan.insertMany(TEMPLATES, { ordered: false }).catch(() => {});
    return;
  }
  // Keep the built-in Starter template up to date with newly implemented features.
  await Plan.updateOne({ name: "Starter" }, { $addToSet: { features: { $each: STARTER_PLAN_FEATURES } } });
  await Plan.updateOne({ name: "Starter", description: OLD_STARTER_DESCRIPTION }, { $set: { description: TEMPLATES[0].description } });
  // One-time: Pro becomes contact-to-activate. Plans that already have the flag keep whatever the admin chose.
  await Plan.updateOne({ name: "Pro", requiresActivation: { $exists: false } }, { $set: { requiresActivation: true } });
}

/** Where shoppers ask to activate a contact-only plan. Set SALES_EMAIL in the environment. */
export const salesEmail = () => {
  const e = (process.env.SALES_EMAIL ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
};
