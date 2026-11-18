// One place that decides what a product costs (NFR-14 style: no pricing rules in views).
import type { ToggleState } from "./features";

type PricedProduct = {
  price: number;
  variants?: { _id: unknown; name: string; price?: number | null; stock: number; sku?: string; barcode?: string }[];
  volumeTiers?: { minQty: number; price: number }[];
  salePrice?: number | null;
  saleEndsAt?: Date | string | null;
  wholesalePrice?: number | null;
  stock: number;
  publishAt?: Date | string | null;
  status?: string;
};

export type PriceContext = { features: ToggleState; wholesale?: boolean; now?: number };

export const hasVariants = (p: PricedProduct) => !!p.variants && p.variants.length > 0;

export function findVariant(p: PricedProduct, variantId?: string | null) {
  if (!hasVariants(p) || !variantId) return undefined;
  return p.variants!.find((v) => String(v._id) === String(variantId));
}

/** F-66: a sale is live when it has a price and its end time is in the future. */
export function saleActive(p: PricedProduct, ctx: PriceContext) {
  const now = ctx.now ?? Date.now();
  return !!(ctx.features["F-66"] && p.salePrice != null && p.saleEndsAt && new Date(p.saleEndsAt).getTime() > now);
}

/** Base price before quantity rules: variant price, else sale price, else list price; wholesale if cheaper. */
export function basePrice(p: PricedProduct, variantId: string | null | undefined, ctx: PriceContext) {
  const v = ctx.features["F-02"] ? findVariant(p, variantId) : undefined;
  let price = v?.price != null ? v.price : p.price;
  if (v?.price == null && saleActive(p, ctx)) price = Math.min(price, p.salePrice!);
  if (ctx.features["F-61"] && ctx.wholesale && p.wholesalePrice != null) price = Math.min(price, p.wholesalePrice);
  return price;
}

/** F-62: the best volume tier for a quantity, if it beats the base price. */
export function unitPrice(p: PricedProduct, variantId: string | null | undefined, qty: number, ctx: PriceContext) {
  let price = basePrice(p, variantId, ctx);
  let rule: string | undefined;
  if (ctx.features["F-62"] && p.volumeTiers?.length) {
    const tier = [...p.volumeTiers].filter((t) => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0];
    if (tier && tier.price < price) {
      price = tier.price;
      rule = `${tier.minQty}+ price`;
    }
  }
  return { price, rule };
}

/** Stock for a product or its chosen variant. */
export function stockOf(p: PricedProduct, variantId?: string | null) {
  if (hasVariants(p)) return findVariant(p, variantId)?.stock ?? 0;
  return p.stock;
}

/** Total stock across variants (for listings). */
export function totalStock(p: PricedProduct) {
  return hasVariants(p) ? p.variants!.reduce((n, v) => n + Math.max(0, v.stock), 0) : p.stock;
}

/** Lowest price a shopper can pay, for listings ("from Rs X"). */
export function fromPrice(p: PricedProduct, ctx: PriceContext) {
  if (ctx.features["F-02"] && hasVariants(p)) return Math.min(...p.variants!.map((v) => basePrice(p, String(v._id), ctx)));
  return basePrice(p, null, ctx);
}

/** F-92: hidden until its publish time. */
export const isPublished = (p: PricedProduct, features: ToggleState, now = Date.now()) =>
  p.status !== "draft" && (!features["F-92"] || !p.publishAt || new Date(p.publishAt).getTime() <= now);

/** Mongo filter for products visible on the storefront. */
export function visibleFilter(features: ToggleState, now = new Date()): Record<string, unknown> {
  const f: Record<string, unknown> = { status: "active" };
  if (features["F-92"]) f.$or = [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }];
  return f;
}
