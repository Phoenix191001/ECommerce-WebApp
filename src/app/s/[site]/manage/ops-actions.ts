"use server";

import { Types } from "mongoose";
import { nextOrderNumber } from "@/lib/models/tenant";
import { actorOf, auditLog, refreshStore, staffCtx } from "@/lib/manage-ctx";
import { adjustStock, defaultWarehouse, quantities, transferStock, type Line } from "@/lib/warehouses";

type S = { error?: string; ok?: string } | undefined;

/** "productId" or "productId:variantId" from a product picker → a stock line with its name. */
async function lineOf(m: Awaited<ReturnType<typeof staffCtx>>["m"], key: string): Promise<Line | null> {
  const [pid, vid] = key.split(":");
  if (!Types.ObjectId.isValid(pid) || (vid && !Types.ObjectId.isValid(vid))) return null;
  const p = await m.Product.findById(pid, { name: 1, variants: 1, bundle: 1, kind: 1 }).lean();
  if (!p || p.bundle?.length || (p.kind && p.kind !== "physical")) return null;
  if (p.variants?.length) {
    const v = p.variants.find((x) => String(x._id) === vid);
    return v ? { product: pid, variant: vid, name: `${p.name} (${v.name})` } : null;
  }
  return { product: pid, name: p.name };
}

// ---------- Warehouses (F-47) and transfers (F-81) ----------

export async function addWarehouse(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "catalog");
  if (!store.features["F-47"]) return { error: "Multi-warehouse stock (F-47) is off." };
  if (user.role === "seller") return { error: "Only the store team can manage warehouses." };
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2) return { error: "Name the warehouse." };
  await defaultWarehouse(m);
  if ((await m.Warehouse.countDocuments()) >= 20) return { error: "You can have up to 20 warehouses." };
  await m.Warehouse.create({ name, address: String(form.get("address") ?? "").trim().slice(0, 200) });
  await auditLog(store, actorOf(user), "warehouse.create", name);
  refreshStore(store);
  return { ok: `${name} added.` };
}

export async function renameWarehouse(site: string, id: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "catalog");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!Types.ObjectId.isValid(id) || name.length < 2) return { error: "Enter a name." };
  await m.Warehouse.updateOne({ _id: id }, { $set: { name, address: String(form.get("address") ?? "").trim().slice(0, 200) } });
  await auditLog(store, actorOf(user), "warehouse.rename", name);
  refreshStore(store);
  return { ok: "Saved." };
}

export async function moveStock(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "catalog");
  if (!store.features["F-81"]) return { error: "Stock transfers (F-81) are off." };
  if (user.role === "seller") return { error: "Only the store team can move stock." };
  const l = await lineOf(m, String(form.get("product") ?? ""));
  if (!l) return { error: "Choose a product." };
  const qty = Math.floor(Number(form.get("qty")));
  const from = String(form.get("from") ?? ""), to = String(form.get("to") ?? "");
  if (!Types.ObjectId.isValid(from) || !Types.ObjectId.isValid(to)) return { error: "Choose both warehouses." };
  const r = await transferStock(m, l, from, to, qty, user.name, String(form.get("note") ?? "").slice(0, 200));
  if (r.error) return { error: r.error };
  await auditLog(store, actorOf(user), "stock.transfer", l.name, from, `${to} × ${qty}`);
  refreshStore(store);
  return { ok: `Moved ${qty} × ${l.name}.` };
}

/** Stock take: set what's actually on the shelf at one warehouse. */
export async function countStock(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "catalog");
  if (!store.features["F-47"]) return { error: "Multi-warehouse stock (F-47) is off." };
  if (user.role === "seller") return { error: "Only the store team can count stock." };
  const l = await lineOf(m, String(form.get("product") ?? ""));
  if (!l) return { error: "Choose a product." };
  const wh = String(form.get("warehouse") ?? "");
  const counted = Math.floor(Number(form.get("qty")));
  if (!Types.ObjectId.isValid(wh) || !(counted >= 0)) return { error: "Choose a warehouse and enter the count." };
  const now = (await quantities(m, l)).get(wh) ?? 0;
  const r = await adjustStock(m, l, wh, counted - now, user.name, String(form.get("note") ?? "Stock count").slice(0, 200));
  if (r.error) return { error: r.error };
  await auditLog(store, actorOf(user), "stock.count", l.name, now, counted);
  refreshStore(store);
  return { ok: `${l.name}: ${now} → ${counted}.` };
}

// ---------- Purchase orders (F-80) ----------

export async function createPurchaseOrder(site: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "catalog");
  if (!store.features["F-80"]) return { error: "Purchase orders (F-80) are off." };
  if (user.role === "seller") return { error: "Only the store team can order from suppliers." };
  const supplier = {
    name: String(form.get("supplier") ?? "").trim().slice(0, 100),
    phone: String(form.get("phone") ?? "").trim().slice(0, 30),
    email: String(form.get("email") ?? "").trim().slice(0, 120),
  };
  if (supplier.name.length < 2) return { error: "Enter the supplier's name." };
  let raw: { key: string; qty: number; cost: number }[] = [];
  try { raw = JSON.parse(String(form.get("items") ?? "[]")); } catch { return { error: "The item list couldn't be read." }; }
  const items = [];
  for (const r of raw.slice(0, 100)) {
    const l = await lineOf(m, r.key);
    const qty = Math.floor(Number(r.qty));
    if (!l || !(qty >= 1)) continue;
    items.push({ product: new Types.ObjectId(l.product), variant: l.variant ? new Types.ObjectId(l.variant) : undefined, name: l.name, qty, cost: Math.max(0, Number(r.cost) || 0), received: 0 });
  }
  if (!items.length) return { error: "Add at least one product with a quantity." };
  const wh = String(form.get("warehouse") ?? "");
  const number = await nextOrderNumber(m, "po");
  const expected = String(form.get("expectedAt") ?? "");
  await m.PurchaseOrder.create({
    number, supplier, items, note: String(form.get("note") ?? "").slice(0, 1000),
    warehouse: Types.ObjectId.isValid(wh) ? new Types.ObjectId(wh) : undefined,
    expectedAt: expected ? new Date(expected) : undefined,
    status: form.get("send") ? "ordered" : "draft",
  });
  await auditLog(store, actorOf(user), "po.create", `PO-${number}`, undefined, supplier.name);
  refreshStore(store);
  return { ok: `Purchase order PO-${number} saved.` };
}

export async function setPurchaseOrderStatus(site: string, id: string, status: "ordered" | "cancelled") {
  const { store, user, m } = await staffCtx(site, "catalog");
  if (!Types.ObjectId.isValid(id) || user.role === "seller") return;
  await m.PurchaseOrder.updateOne({ _id: id, status: { $in: status === "ordered" ? ["draft"] : ["draft", "ordered"] } }, { $set: { status } });
  await auditLog(store, actorOf(user), `po.${status}`, id);
  refreshStore(store);
}

/** Receive some or all of a purchase order: adds stock at its warehouse and updates cost prices. */
export async function receivePurchaseOrder(site: string, id: string, _: S, form: FormData): Promise<S> {
  const { store, user, m } = await staffCtx(site, "catalog");
  if (!Types.ObjectId.isValid(id) || user.role === "seller") return { error: "Purchase order not found." };
  const po = await m.PurchaseOrder.findById(id);
  if (!po || !["ordered", "draft"].includes(po.status)) return { error: "Only open purchase orders can be received." };
  const wh = po.warehouse ? String(po.warehouse) : String((await defaultWarehouse(m))._id);
  let got = 0;
  for (const [i, it] of po.items.entries()) {
    const qty = Math.max(0, Math.min(it.qty - it.received, Math.floor(Number(form.get(`recv_${i}`) ?? 0))));
    if (!qty) continue;
    const l = { product: String(it.product), variant: it.variant ? String(it.variant) : undefined, name: it.name };
    if (store.features["F-47"]) await adjustStock(m, l, wh, qty, user.name, `PO-${po.number} from ${po.supplier.name}`, "receive");
    else {
      const { releaseStock } = await import("@/lib/stock");
      await releaseStock(m, [{ ...l, qty }]);
    }
    if (store.features["F-82"] && it.cost > 0 && !it.variant) await m.Product.updateOne({ _id: it.product }, { $set: { costPrice: it.cost } });
    it.received += qty;
    got += qty;
  }
  if (!got) return { error: "Enter how many of each item arrived." };
  if (po.items.every((it) => it.received >= it.qty)) {
    po.status = "received";
    po.receivedAt = new Date();
  } else if (po.status === "draft") po.status = "ordered";
  await po.save();
  await auditLog(store, actorOf(user), "po.receive", `PO-${po.number}`, undefined, got);
  refreshStore(store);
  return { ok: `Received ${got} item(s). Stock is updated.` };
}
