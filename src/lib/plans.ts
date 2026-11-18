import "server-only";
import { ALL_FEATURE_IDS, FEATURES } from "./features";
import { platformDb } from "./db";
import { platformModels } from "./models/platform";

// FR-A-04 plan templates. Which plans launch first is an open question in the SRS,
// so these are starting points the Super Admin can edit.
const TEMPLATES = [
  {
    name: "Starter",
    description: "Core online store: catalog, cart, checkout, COD and card payments.",
    priceMonthly: 0,
    features: FEATURES.filter((f) => f.defaultOn).map((f) => f.id),
    maxProducts: 100,
    maxStaff: 2,
    maxDomains: 0,
  },
  {
    name: "Pro",
    description: "Every feature in the catalog, including POS and custom domains.",
    priceMonthly: 0,
    features: ALL_FEATURE_IDS,
    maxProducts: 0,
    maxStaff: 0,
    maxDomains: 3,
  },
];

export async function ensurePlans() {
  const { Plan } = platformModels(await platformDb());
  if ((await Plan.estimatedDocumentCount()) > 0) return;
  await Plan.insertMany(TEMPLATES, { ordered: false }).catch(() => {});
}
