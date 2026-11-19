import "server-only";
import { Types } from "mongoose";
import type { TenantModels } from "./models/tenant";
import { releaseStock, reserveStock } from "./stock";

// F-47 multi-warehouse stock. The product's stock stays the total the store can sell.
// Non-default warehouses keep rows in WarehouseStock; the default warehouse holds the rest
// (total minus the other warehouses). Online and POS sales take from the default warehouse,
// so selling needs no extra bookkeeping.

export async function defaultWarehouse(m: TenantModels) {
  const d = await m.Warehouse.findOne({ isDefault: true }).lean();
  if (d) return d;
  return (await m.Warehouse.create({ name: "Main warehouse", isDefault: true })).toObject();
}

const oid = (v?: string) => (v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : undefined);
export type Line = { product: string; variant?: string; name: string };

async function total(m: TenantModels, l: Line) {
  const p = await m.Product.findById(l.product, { stock: 1, variants: 1 }).lean();
  if (!p) return null;
  if (l.variant) return p.variants.find((v) => String(v._id) === l.variant)?.stock ?? null;
  return p.stock;
}

/** Quantity at each warehouse for one product line, including the default warehouse. */
export async function quantities(m: TenantModels, l: Line) {
  const [d, rows, t] = await Promise.all([
    defaultWarehouse(m),
    m.WarehouseStock.find({ product: oid(l.product), variant: oid(l.variant) ?? null }).lean(),
    total(m, l),
  ]);
  const map = new Map(rows.map((r) => [String(r.warehouse), r.qty]));
  const others = rows.reduce((n, r) => n + r.qty, 0);
  map.set(String(d._id), (t ?? 0) - others);
  return map;
}

async function addRow(m: TenantModels, warehouse: string, l: Line, qty: number) {
  if (qty >= 0) {
    await m.WarehouseStock.updateOne({ warehouse: oid(warehouse), product: oid(l.product), variant: oid(l.variant) ?? null }, { $inc: { qty } }, { upsert: true });
    return true;
  }
  const r = await m.WarehouseStock.updateOne({ warehouse: oid(warehouse), product: oid(l.product), variant: oid(l.variant) ?? null, qty: { $gte: -qty } }, { $inc: { qty } });
  return r.modifiedCount === 1;
}

/** Move stock between warehouses. The total doesn't change. */
export async function transferStock(m: TenantModels, l: Line, from: string, to: string, qty: number, by: string, note = "") {
  if (from === to || qty <= 0) return { error: "Choose two different warehouses and a quantity." };
  const d = String((await defaultWarehouse(m))._id);
  if (from === d) {
    const have = (await quantities(m, l)).get(d) ?? 0;
    if (have < qty) return { error: `Only ${Math.max(0, have)} of ${l.name} at the source warehouse.` };
  } else if (!(await addRow(m, from, l, -qty))) return { error: `Not enough ${l.name} at the source warehouse.` };
  if (to !== d) await addRow(m, to, l, qty);
  await m.StockMove.create({ kind: "transfer", product: oid(l.product), variant: oid(l.variant), name: l.name, from: oid(from), to: oid(to), qty, note, by });
  return { ok: true };
}

/** Change the count at one warehouse (stock take, damage, a delivery). Changes the total too. */
export async function adjustStock(m: TenantModels, l: Line, warehouse: string, delta: number, by: string, note = "", kind: "adjust" | "receive" = "adjust") {
  if (!delta) return { ok: true };
  const d = String((await defaultWarehouse(m))._id);
  const line = { product: l.product, variant: l.variant, qty: Math.abs(delta), name: l.name };
  if (delta < 0) {
    if (warehouse !== d && !(await addRow(m, warehouse, l, delta))) return { error: `Not enough ${l.name} there.` };
    const r = await reserveStock(m, [line]);
    if (r.short) {
      if (warehouse !== d) await addRow(m, warehouse, l, -delta);
      return { error: `Not enough ${l.name} in stock.` };
    }
  } else {
    if (warehouse !== d) await addRow(m, warehouse, l, delta);
    await releaseStock(m, [line]);
  }
  await m.StockMove.create({ kind, product: oid(l.product), variant: oid(l.variant), name: l.name, ...(delta > 0 ? { to: oid(warehouse) } : { from: oid(warehouse) }), qty: delta, note, by });
  return { ok: true };
}

/** Every stockable product line (product, or product + variant) for pickers. */
export async function stockLines(m: TenantModels, limit = 1000) {
  const ps = await m.Product.find({ $or: [{ bundle: { $size: 0 } }, { bundle: { $exists: false } }], kind: { $nin: ["digital", "giftcard"] } }, { name: 1, variants: 1, stock: 1, sku: 1 })
    .sort({ name: 1 }).limit(limit).lean();
  return ps.flatMap((p) =>
    p.variants?.length
      ? p.variants.map((v) => ({ key: `${p._id}:${v._id}`, product: String(p._id), variant: String(v._id), name: `${p.name} (${v.name})`, total: v.stock }))
      : [{ key: String(p._id), product: String(p._id), variant: undefined as string | undefined, name: p.name, total: p.stock }],
  );
}
