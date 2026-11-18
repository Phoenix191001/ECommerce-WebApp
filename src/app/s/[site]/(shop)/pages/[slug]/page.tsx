import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore, requireStore, storeModels } from "@/lib/tenant";
import { RichText } from "@/components/store/rich-text";

type Props = { params: Promise<{ site: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, slug } = await params;
  const store = await getStore(site);
  const pg = store ? await (await storeModels(store)).Page.findOne({ slug, kind: "page", published: true }).lean() : null;
  return pg ? { title: pg.title, description: pg.excerpt || undefined } : {};
}

export default async function ContentPage({ params }: Props) {
  const { site, slug } = await params;
  const store = await requireStore(site);
  if (!store.features["F-40"]) notFound();
  const pg = await (await storeModels(store)).Page.findOne({ slug, kind: "page", published: true }).lean();
  if (!pg) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-4xl font-extrabold">{pg.title}</h1>
      <article className="rounded-3xl bg-white p-6 shadow-sm"><RichText text={pg.body} /></article>
    </main>
  );
}
