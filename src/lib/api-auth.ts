import "server-only";
import crypto from "node:crypto";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";

/** F-112: check "Authorization: Bearer sk_…" against this store's hashed keys. */
export async function apiAuth(store: StoreContext, req: Request) {
  if (!store.features["F-112"]) return false;
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key.startsWith("sk_")) return false;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const m = await storeModels(store);
  const found = await m.ApiKey.findOneAndUpdate({ hash }, { $set: { lastUsedAt: new Date() } }).lean();
  return !!found;
}

export const page = (url: URL) => {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  const p = Math.max(1, Number(url.searchParams.get("page")) || 1);
  return { limit, skip: (p - 1) * limit, page: p };
};
