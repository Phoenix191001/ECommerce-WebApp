import { storeModels, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card } from "@/components/admin/ui";
import { ProductEditor } from "@/components/manage/forms";
import { editorExtras } from "@/lib/editor-extras";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Add product" };

export default async function NewProduct({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  const user = await requireStaff(store, "catalog", { seller: true });
  const m = await storeModels(store);
  const [categories, extras] = await Promise.all([m.Product.distinct("category", { category: { $ne: "" } }), editorExtras(store, m, user)]);
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{T("Add product")}</h1>
      <Card accent="emerald"><ProductEditor site={site} categories={categories} features={store.features} uploadUrl={`${store.base}/manage/upload`} storeId={store.id} catalog={extras.catalog} sellers={extras.sellers} /></Card>
    </>
  );
}
