// Feature toggle catalog — SRS Section 3 (plus F-89 from Section 4.6).
// This file is the single source of truth for every toggle (NFR-14).

export type FeatureGroup =
  | "catalog"
  | "checkout"
  | "pos"
  | "marketing"
  | "checkoutExtra"
  | "pricing"
  | "customers"
  | "seo"
  | "operations"
  | "storefront"
  | "products"
  | "orders"
  | "engagement"
  | "ownerTools"
  | "security";

export interface Feature {
  id: string;
  name: string;
  defaultOn: boolean;
  requires: string[];
  group: FeatureGroup;
}

export const GROUP_LABELS: Record<FeatureGroup, string> = {
  catalog: "Catalog and Storefront",
  checkout: "Inventory, Cart, and Checkout",
  pos: "Cashier and Point of Sale",
  marketing: "Marketing, Content, and Operations",
  checkoutExtra: "Checkout and Payments (Additional)",
  pricing: "Catalog and Pricing (Additional)",
  customers: "Customers and Growth (Additional)",
  seo: "Marketing, SEO, and Analytics (Additional)",
  operations: "Operations and Staff (Additional)",
  storefront: "Storefront and Domains (Additional)",
  products: "Products and Catalog (Additional)",
  orders: "Orders, Returns, and Billing (Additional)",
  engagement: "Customers and Engagement (Additional)",
  ownerTools: "Owner Tools and Integrations (Additional)",
  security: "Security and Reliability (Additional)",
};

type Row = [number, string, boolean, number[], FeatureGroup];

const ON = true;
const OFF = false;

const ROWS: Row[] = [
  // 3.1 Catalog and Storefront
  [1, "Product catalog", ON, [], "catalog"],
  [2, "Product variants (size, color)", ON, [1], "catalog"],
  [3, "Product image gallery", ON, [1], "catalog"],
  [4, "Product reviews and ratings", OFF, [1, 22], "catalog"],
  [5, "Product search with filters", ON, [1], "catalog"],
  [6, "Category and subcategory tree", ON, [1], "catalog"],
  [7, "Brand pages", OFF, [1], "catalog"],
  [8, "Related and recommended products", OFF, [1], "catalog"],
  [9, "Recently viewed products", OFF, [1], "catalog"],
  [10, "Wishlist", OFF, [22], "catalog"],
  [11, "Product comparison", OFF, [1], "catalog"],
  [12, "Digital products and downloads", OFF, [1], "catalog"],
  [13, "Bundles and kits", OFF, [1], "catalog"],
  [14, "Pre-order and back-in-stock alerts", OFF, [1, 17], "catalog"],
  [15, "Storefront theme switching", ON, [], "catalog"],
  [16, "Multi-language storefront", OFF, [], "catalog"],
  // 3.2 Inventory, Cart, and Checkout
  [17, "Inventory tracking", ON, [], "checkout"],
  [18, "Low-stock alerts", OFF, [17], "checkout"],
  [19, "Guest checkout", ON, [], "checkout"],
  [20, "Mini cart drawer", ON, [], "checkout"],
  [21, "Cart-level coupons", OFF, [27], "checkout"],
  [22, "Customer accounts", ON, [], "checkout"],
  [23, "Cash on delivery", ON, [29], "checkout"],
  [24, "Card payments", ON, [30], "checkout"],
  [25, "Wallet payments (JazzCash, Easypaisa)", OFF, [30], "checkout"],
  [26, "Split payments", OFF, [24, 23], "checkout"],
  [27, "Discount codes", OFF, [], "checkout"],
  [28, "Loyalty points", OFF, [22], "checkout"],
  [29, "Shipping: flat rate and zones", ON, [], "checkout"],
  [30, "Payment gateway integration", ON, [], "checkout"],
  [31, "Tax calculation", ON, [], "checkout"],
  [32, "Gift cards", OFF, [30], "checkout"],
  [33, "Subscriptions", OFF, [30, 22], "checkout"],
  // 3.3 Cashier and Point of Sale
  [34, "Cashier POS screen", OFF, [17], "pos"],
  [35, "Barcode scanning", OFF, [34], "pos"],
  [36, "Cash drawer shift open and close", OFF, [34], "pos"],
  [37, "Refunds at POS", OFF, [34, 38], "pos"],
  [38, "Refund approval limit by role", OFF, [34], "pos"],
  [39, "Receipt printing", OFF, [34], "pos"],
  // 3.4 Marketing, Content, and Operations
  [40, "Blog and content pages", OFF, [], "marketing"],
  [41, "Email notifications", ON, [], "marketing"],
  [42, "SMS notifications", OFF, [41], "marketing"],
  [43, "Abandoned cart reminders", OFF, [41, 22], "marketing"],
  [44, "Newsletter signup", OFF, [41], "marketing"],
  [45, "Live chat widget", OFF, [], "marketing"],
  [46, "Customer order returns", OFF, [22, 51], "marketing"],
  [47, "Multi-warehouse stock", OFF, [17], "marketing"],
  [48, "Staff roles and permissions", ON, [], "marketing"],
  [49, "Analytics dashboard", ON, [], "marketing"],
  [50, "Export of orders and products (CSV)", ON, [], "marketing"],
  [51, "Order tracking page", ON, [], "marketing"],
  [52, "Invoice generation (PDF)", ON, [], "marketing"],
  // 3.5 Checkout and Payments (Additional)
  [53, "Cash on delivery with OTP confirmation", OFF, [23, 42], "checkoutExtra"],
  [54, "WhatsApp order button", OFF, [], "checkoutExtra"],
  [55, "Multi-currency display and checkout", OFF, [30], "checkoutExtra"],
  [56, "Store credit balance", OFF, [22], "checkoutExtra"],
  [57, "Checkout upsells and cross-sells", OFF, [20], "checkoutExtra"],
  [58, "Free-shipping threshold", OFF, [29], "checkoutExtra"],
  [59, "Local pickup", OFF, [29], "checkoutExtra"],
  [60, "Delivery time slots", OFF, [29], "checkoutExtra"],
  // 3.6 Catalog and Pricing (Additional)
  [61, "Wholesale or B2B pricing tiers", OFF, [22], "pricing"],
  [62, "Volume pricing", OFF, [1], "pricing"],
  [63, "Product customization fields", OFF, [2], "pricing"],
  [64, "Size guide", OFF, [2], "pricing"],
  [65, "Product questions and answers", OFF, [1], "pricing"],
  [66, "Flash sales with countdown timers", OFF, [27], "pricing"],
  [67, "Multi-seller marketplace", OFF, [1, 22], "pricing"],
  // 3.7 Customers and Growth (Additional)
  [68, "Social login (Google, Facebook)", OFF, [22], "customers"],
  [69, "Two-factor login for customers", OFF, [22], "customers"],
  [70, "Referral program", OFF, [22, 41], "customers"],
  [71, "Affiliate links and commissions", OFF, [22], "customers"],
  [72, "Customer segments", OFF, [22], "customers"],
  [73, "Support tickets and help desk", OFF, [22], "customers"],
  [74, "Gift wrapping and gift messages", OFF, [1], "customers"],
  // 3.8 Marketing, SEO, and Analytics (Additional)
  [75, "SEO settings and sitemap", ON, [], "seo"],
  [76, "Google Analytics and Meta Pixel", OFF, [], "seo"],
  [77, "Product feed export (Google Shopping, Meta)", OFF, [1], "seo"],
  [78, "A/B testing of storefront sections", OFF, [15], "seo"],
  [79, "Cookie consent banner", OFF, [], "seo"],
  // 3.9 Operations and Staff (Additional)
  [80, "Purchase orders to suppliers", OFF, [17, 48], "operations"],
  [81, "Stock transfers between warehouses", OFF, [47], "operations"],
  [82, "Expense tracking and profit reports", OFF, [49], "operations"],
  [83, "Packing slips and shipping labels", OFF, [17], "operations"],
  [84, "Staff shift and attendance tracking", OFF, [48], "operations"],
  [85, "Offline mode for POS", OFF, [34], "operations"],
  // 3.10 Storefront (Additional) + 4.6 custom domain
  [86, "Progressive web app install", OFF, [15], "storefront"],
  [87, "Dark mode storefront theme", OFF, [15], "storefront"],
  [88, "Store locator page", OFF, [], "storefront"],
  [89, "Custom domain", OFF, [], "storefront"],
  // 3.11 Products and Catalog (Additional)
  [90, "Bulk product import and export (CSV)", OFF, [1], "products"],
  [91, "Bulk price and stock editing", OFF, [1], "products"],
  [92, "Scheduled product publishing", OFF, [1], "products"],
  [93, "Product tags and custom fields", OFF, [1], "products"],
  [94, "Auto-translation of product text", OFF, [16], "products"],
  [95, "AI product description writer", OFF, [1], "products"],
  [96, "Typo-tolerant smart search", OFF, [5], "products"],
  [97, "Print-on-demand and dropshipping links", OFF, [17], "products"],
  // 3.12 Orders, Returns, and Billing (Additional)
  [98, "Order editing after placement", OFF, [], "orders"],
  [99, "Partial shipments", OFF, [29], "orders"],
  [100, "Exchanges, not just refunds", OFF, [46], "orders"],
  [101, "Stock reservation during checkout", ON, [17], "orders"],
  [102, "Reorder button for past orders", OFF, [22], "orders"],
  [103, "Saved payment methods (tokenized)", OFF, [30, 22], "orders"],
  [104, "Tax invoices with NTN and GST details", OFF, [31], "orders"],
  [105, "Two-person approval for large refunds", OFF, [38], "orders"],
  [106, "Order risk scoring for fraud", OFF, [30], "orders"],
  // 3.13 Customers and Engagement (Additional)
  [107, "Multiple saved addresses", ON, [22], "engagement"],
  [108, "Birthday and anniversary rewards", OFF, [28], "engagement"],
  [109, "Web push notifications", OFF, [41], "engagement"],
  [110, "Telegram or WhatsApp order updates", OFF, [41], "engagement"],
  [111, "Warranty tracking", OFF, [1], "engagement"],
  // 3.14 Owner Tools and Integrations (Additional)
  [112, "Owner API access and webhooks", OFF, [], "ownerTools"],
  [113, "Zapier or Make integration", OFF, [112], "ownerTools"],
  [114, "Plugin and app marketplace", OFF, [112], "ownerTools"],
  [115, "Custom CSS and code editor", OFF, [], "ownerTools"],
  [116, "Drag-and-drop page builder", OFF, [40], "ownerTools"],
  [117, "Navigation menu editor", ON, [], "ownerTools"],
  [118, "Announcement bar and pop-ups", OFF, [], "ownerTools"],
  [119, "Exit-intent offers at checkout", OFF, [20], "ownerTools"],
  // 3.15 Security and Reliability (Additional)
  [120, "CAPTCHA and bot protection", ON, [], "security"],
  [121, "Login rate limiting and lockout", ON, [22], "security"],
  [122, "Owner-visible audit log", OFF, [48], "security"],
];

export const fid = (n: number) => `F-${String(n).padStart(2, "0")}`;

export const FEATURES: Feature[] = ROWS.map(([n, name, defaultOn, req, group]) => ({
  id: fid(n),
  name,
  defaultOn,
  requires: req.map(fid),
  group,
}));

export const FEATURE_MAP: Record<string, Feature> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f]),
);

export const ALL_FEATURE_IDS = FEATURES.map((f) => f.id);

export type ToggleState = Record<string, boolean>;

/** Default toggle states for a new instance, limited to features the plan includes. */
export function defaultToggles(planFeatures: string[], pack: string[] = STARTER_PACK): ToggleState {
  const allowed = new Set(planFeatures);
  const state: ToggleState = {};
  const on = new Set(pack);
  for (const f of FEATURES) state[f.id] = on.has(f.id) && allowed.has(f.id);
  return state;
}

/** Prerequisites of `id` that are currently off (FR-A-03). */
export function missingPrereqs(id: string, state: ToggleState): string[] {
  const f = FEATURE_MAP[id];
  if (!f) return [];
  return f.requires.filter((r) => !isEffective(r, state));
}

/** A feature is effective when it is on and every prerequisite is effective. */
export function isEffective(id: string, state: ToggleState, seen = new Set<string>()): boolean {
  if (!state[id]) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  const f = FEATURE_MAP[id];
  return !f || f.requires.every((r) => isEffective(r, state, seen));
}

export function effectiveToggles(state: ToggleState): ToggleState {
  const out: ToggleState = {};
  for (const f of FEATURES) out[f.id] = isEffective(f.id, state);
  return out;
}

/** Features that list `id` as a prerequisite. */
export function dependentsOf(id: string): string[] {
  return FEATURES.filter((f) => f.requires.includes(id)).map((f) => f.id);
}

// ---------------------------------------------------------------------------
// Docs, starter pack, and what is wired to real behavior

export { DESCRIPTIONS } from "./feature-docs";

/** Features this build implements end to end. Others are saved as settings and marked "coming soon". */
export const IMPLEMENTED = new Set(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 27, 28, 29, 31, 34, 35, 36, 37, 38, 39,
   40, 41, 44, 46, 48, 49, 50, 51, 52, 54, 56, 58, 59, 60, 61, 62, 64, 65, 66, 69, 70, 72, 73, 74, 75, 76, 77, 79,
   82, 83, 84, 86, 87, 88, 89, 90, 91, 92, 93, 96, 98, 100, 101, 102, 104, 105, 106, 107, 111, 112, 113, 115, 117,
   118, 119, 121, 122].map(fid),
);

/**
 * Recommended starter pack: the SRS defaults plus a few features most new stores want on day one.
 * New instances start with these (limited to their plan).
 */
export const STARTER_PACK: string[] = Array.from(
  new Set([
    ...FEATURES.filter((f) => f.defaultOn).map((f) => f.id),
    ...[4, 10, 21, 27, 54, 58, 118, 122].map(fid),
  ]),
);

/** Turn-on order for `id` including every prerequisite that is off (prerequisites first). */
export function enableChain(id: string, state: ToggleState): string[] {
  const out: string[] = [];
  const visit = (x: string, seen: Set<string>) => {
    if (seen.has(x)) return;
    seen.add(x);
    for (const r of FEATURE_MAP[x]?.requires ?? []) visit(r, seen);
    if (!state[x] && !out.includes(x)) out.push(x);
  };
  visit(id, new Set());
  return out;
}

/** Features that become usable when `id` is on (direct dependents). Alias for docs. */
export const unlocks = (id: string) => dependentsOf(id);
