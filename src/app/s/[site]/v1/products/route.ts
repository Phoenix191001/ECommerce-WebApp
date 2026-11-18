import { getStore, storeModels } from "@/lib/tenant";
import { apiAuth, page } from "@/lib/api-auth";

export async function GET(req: Request, { params }: { params: Promise<{ site: string }> }) {
  const store = await getStore((await params).site);
  if (!store || !(await apiAuth(store, req))) return Response.json({ error: "Invalid or missing API key." }, { status: 401 });
  const { limit, skip, page: p } = page(new URL(req.url));
  const m = await storeModels(store);
  const [items, total] = await Promise.all([
    m.Product.find({}, { costPrice: 0, __v: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    m.Product.countDocuments(),
  ]);
  return Response.json({ page: p, limit, total, data: items });
}

export const dynamic = "force-dynamic";
