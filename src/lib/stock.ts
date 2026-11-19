import "server-only";
import { Types } from "mongoose";
import type { TenantModels } from "./models/tenant";

export type StockLine = { product: string; variant?: string; qty: number; name: string };

/** Atomically take stock for each line (variant-aware). Rolls back and returns the short item on failure. */
export async function reserveStock(m: TenantModels, lines: StockLine[]): Promise<{ short?: string }> {
  const done: StockLine[] = [];
  for (const l of lines) {
    const r = l.variant
      ? await m.Product.updateOne(
          { _id: l.product, variants: { $elemMatch: { _id: new Types.ObjectId(l.variant), stock: { $gte: l.qty } } } },
          { $inc: { "variants.$.stock": -l.qty } },
        )
      : await m.Product.updateOne({ _id: l.product, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty } });
    if (r.modifiedCount !== 1) {
      await releaseStock(m, done);
      return { short: l.name };
    }
    done.push(l);
  }
  return {};
}

/** Give stock back (cancellations, returns, edits, rollbacks). */
export async function releaseStock(m: TenantModels, lines: StockLine[]) {
  for (const l of lines) {
    if (l.qty <= 0) continue;
    if (l.variant)
      await m.Product.updateOne({ _id: l.product, "variants._id": new Types.ObjectId(l.variant) }, { $inc: { "variants.$.stock": l.qty } });
    else await m.Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty } });
  }
}

type LineLike = {
  product: unknown; variant?: unknown; qty: number; name: string;
  kind?: string | null; bundle?: { product: unknown; qty: number; name: string }[] | null;
};

/** Stock lines for order or cart items. Digital items and gift cards hold no stock (F-12, F-32);
 *  a bundle takes stock from its parts (F-13). */
export const linesOf = (items: LineLike[]): StockLine[] =>
  items.flatMap((i): StockLine[] => {
    if (i.kind === "digital" || i.kind === "giftcard") return [];
    if (i.bundle?.length) return i.bundle.map((b) => ({ product: String(b.product), qty: b.qty * i.qty, name: `${b.name} (in ${i.name})` }));
    return [{ product: String(i.product), variant: i.variant ? String(i.variant) : undefined, qty: i.qty, name: i.name }];
  });

/** Merge lines for the same product/variant (a bundle and its part both in one cart). */
export const mergeLines = (lines: StockLine[]): StockLine[] => {
  const map = new Map<string, StockLine>();
  for (const l of lines) {
    const k = `${l.product}:${l.variant ?? ""}`;
    const ex = map.get(k);
    if (ex) ex.qty += l.qty;
    else map.set(k, { ...l });
  }
  return [...map.values()];
};

/** F-85: take stock even if it goes below zero (a sale already happened offline). */
export async function forceTakeStock(m: TenantModels, lines: StockLine[]) {
  for (const l of lines) {
    if (l.qty <= 0) continue;
    if (l.variant)
      await m.Product.updateOne({ _id: l.product, "variants._id": new Types.ObjectId(l.variant) }, { $inc: { "variants.$.stock": -l.qty } });
    else await m.Product.updateOne({ _id: l.product }, { $inc: { stock: -l.qty } });
  }
}
