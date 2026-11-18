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

export const linesOf = (items: { product: unknown; variant?: unknown; qty: number; name: string }[]): StockLine[] =>
  items.map((i) => ({ product: String(i.product), variant: i.variant ? String(i.variant) : undefined, qty: i.qty, name: i.name }));
