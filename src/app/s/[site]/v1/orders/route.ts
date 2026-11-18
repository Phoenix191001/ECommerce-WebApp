import { getStore, storeModels } from "@/lib/tenant";
import { apiAuth, page } from "@/lib/api-auth";

const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];

export async function GET(req: Request, { params }: { params: Promise<{ site: string }> }) {
  const store = await getStore((await params).site);
  if (!store || !(await apiAuth(store, req))) return Response.json({ error: "Invalid or missing API key." }, { status: 401 });
  const url = new URL(req.url);
  const { limit, skip, page: p } = page(url);
  const status = url.searchParams.get("status");
  const filter = status && STATUSES.includes(status) ? { status: status as "pending" } : {};
  const m = await storeModels(store);
  const [items, total] = await Promise.all([
    m.Order.find(filter, { trackingToken: 0, __v: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    m.Order.countDocuments(filter),
  ]);
  return Response.json({ page: p, limit, total, data: items });
}

export const dynamic = "force-dynamic";
