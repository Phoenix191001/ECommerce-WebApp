import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card } from "@/components/admin/ui";
import { PageEditor } from "@/components/manage/content-forms";
import { deletePage } from "../../../manage-actions";
import { cleanBlocks } from "@/lib/blocks";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ site: string; id: string }> }) {
  const { site, id } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "settings");
  if (!store.features["F-40"] || !Types.ObjectId.isValid(id)) notFound();
  const m = await storeModels(store);
  const [pg, categories] = await Promise.all([m.Page.findById(id).lean(), m.Product.distinct("category", { category: { $ne: "" } })]);
  if (!pg) notFound();
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{pg.title}</h1>
      <Card accent="emerald"><PageEditor site={site} builder={!!store.features["F-116"]} categories={categories} page={{ id, kind: pg.kind, title: pg.title, body: pg.body, excerpt: pg.excerpt, published: pg.published, blocks: cleanBlocks(pg.blocks) }} /></Card>
      <Card accent="rose">
        <form action={deletePage.bind(null, site, id)} className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Delete this {pg.kind === "post" ? "post" : "page"}.</p>
          <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Delete</button>
        </form>
      </Card>
    </>
  );
}
