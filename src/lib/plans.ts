import "server-only";
import { ALL_FEATURE_IDS, IMPLEMENTED, STARTER_PACK } from "./features";
import { platformDb } from "./db";
import { platformModels } from "./models/platform";

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
  },
  {
    name: "Pro",
    description: "Every feature in the catalog, including the cashier POS and custom domains.",
    priceMonthly: 0,
    features: ALL_FEATURE_IDS,
    maxProducts: 0,
    maxStaff: 0,
    maxDomains: 3,
  },
];

export async function ensurePlans() {
  const { Plan } = platformModels(await platformDb());
  if ((await Plan.estimatedDocumentCount()) === 0) {
    await Plan.insertMany(TEMPLATES, { ordered: false }).catch(() => {});
    return;
  }
  // Keep the built-in Starter template up to date with newly implemented features.
  await Plan.updateOne({ name: "Starter" }, { $addToSet: { features: { $each: STARTER_PLAN_FEATURES } } });
}
