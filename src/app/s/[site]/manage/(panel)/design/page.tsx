import Link from "next/link";
import { requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { panelPrefs } from "@/lib/panel-i18n";
import { Card } from "@/components/admin/ui";
import { DesignEditor } from "@/components/manage/design-editor";
import { cleanTheme } from "@/lib/theme";

export const metadata = { title: "Design" };

// F-15: the store's whole look — colours of every part, fonts, banner and images — with a live preview.
export default async function DesignPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "settings");
  const { t: T } = await panelPrefs(store);
  const b = `${store.base}/manage`;
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🎨 {T("Design")}</h1>
        <p className="text-sm text-slate-500">
          {T("Change the colour of every part of your store, the fonts, the top banner and pictures. Pick a ready-made theme, then adjust anything you like.")}{" "}
          <a href={store.base || "/"} target="_blank" className="font-medium text-teal-700 hover:underline">{T("View store ↗")}</a>
        </p>
      </div>
      {!store.features["F-15"] ? (
        <Card accent="amber">
          <p className="text-sm text-slate-700">{T("Turn on Storefront theme switching (F-15) to design your store.")} <Link href={`${b}/features`} className="font-medium text-teal-700 hover:underline">{T("Go to Features")}</Link></p>
        </Card>
      ) : (
        <Card accent="indigo">
          <DesignEditor
            site={site}
            initial={cleanTheme(store.branding.theme, store.branding.primaryColor)}
            saved={!!store.branding.theme}
            storeName={store.name}
            uploadUrl={`${store.base}/manage/upload`}
            storeId={store.id}
          />
        </Card>
      )}
    </>
  );
}
