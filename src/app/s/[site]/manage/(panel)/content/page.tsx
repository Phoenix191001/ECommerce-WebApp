import Link from "next/link";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card } from "@/components/admin/ui";
import { ExtrasForm, PageEditor } from "@/components/manage/content-forms";
import { ActionForm } from "@/components/manage/action-form";
import { setHomePage } from "../../growth-actions";
import { inputCls } from "@/components/admin/ui";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Content" };

export default async function Content({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  await requireStaff(store, "settings");
  const f = store.features;
  const pages = f["F-40"] ? await (await storeModels(store)).Page.find().sort({ createdAt: -1 }).lean() : [];
  const b = store.base;
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{T("Content and storefront")}</h1>
      {f["F-40"] ? (
        <>
          <Card title={T("📄 Pages and blog posts")} accent="sky">
            {pages.length === 0 ? <p className="text-sm text-slate-500">{T("No pages yet. Add an About page or your first blog post below.")}</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {pages.map((pg) => (
                  <li key={String(pg._id)} className="flex flex-wrap items-center gap-2 py-2">
                    <Badge tone={pg.kind === "post" ? "violet" : "sky"}>{pg.kind === "post" ? "blog post" : "page"}</Badge>
                    <Link href={`${b}/manage/content/${pg._id}`} className="font-medium hover:underline">{pg.title}</Link>
                    {!pg.published && <Badge tone="slate">{T("draft")}</Badge>}
                    <a href={`${b}/${pg.kind === "post" ? "blog" : "pages"}/${pg.slug}`} target="_blank" className="ms-auto text-xs text-emerald-700 hover:underline">{T("View ↗")}</a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {f["F-116"] && (
            <Card title={T("🏠 Home page")} accent="amber">
              <ActionForm action={setHomePage.bind(null, site)} submit={T("Save")} className="flex flex-wrap items-end gap-3">
                <label className="flex-1 space-y-1 text-sm font-medium text-slate-700">{T("Show this built page as your home page")}
                  <select name="homePage" defaultValue={store.settings.homePage} className={inputCls}>
                    <option value="">{T("The product list (default)")}</option>
                    {pages.filter((p) => p.kind === "page").map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
                  </select>
                </label>
              </ActionForm>
              <p className="mt-2 text-xs text-slate-500">{T("Build the page with blocks first (open it from the list above). Add a “Products” block so shoppers can still buy from the home page.")}</p>
            </Card>
          )}
          <Card title={T("➕ New page or post")} accent="emerald"><PageEditor site={site} builder={!!f["F-116"]} /></Card>
        </>
      ) : <Card><p className="text-sm text-slate-600">{T("Turn on Blog and content pages (F-40) under Features to write pages and blog posts.")}</p></Card>}
      <Card title={T("🧭 Menu, locations, tracking, and styling")} accent="violet">
        <ExtrasForm site={site} f={f} v={{ menu: store.settings.menu, locations: store.settings.locations, gaId: store.settings.gaId, pixelId: store.settings.pixelId, exitOfferCode: store.settings.exitOfferCode, customCss: store.settings.customCss }} />
      </Card>
    </>
  );
}
