import { storeModels, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card } from "@/components/admin/ui";
import { ProductEditor } from "@/components/manage/forms";

export const metadata = { title: "Add product" };

export default async function NewProduct({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "catalog");
  const categories = await (await storeModels(store)).Product.distinct("category", { category: { $ne: "" } });
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Add product</h1>
      <Card accent="emerald"><ProductEditor site={site} categories={categories} /></Card>
    </>
  );
}
