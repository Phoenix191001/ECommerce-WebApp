import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore, requireStore, storeModels } from "@/lib/tenant";
import { RichText } from "@/components/store/rich-text";
import { Blocks } from "@/components/store/blocks";
import { cleanBlocks } from "@/lib/blocks";
import { storePrefs } from "@/lib/store-prefs";
import { displayCurrency } from "@/lib/currency";

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
  const blocks = store.features["F-116"] ? cleanBlocks(pg.blocks) : [];
  if (blocks.length) {
    const [{ t }, cur] = await Promise.all([storePrefs(store), displayCurrency(store)]);
    return <main className="py-8"><Blocks blocks={blocks} store={store} site={site} L={t} cur={cur} /></main>;
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-4xl font-extrabold">{pg.title}</h1>
      <article className="rounded-3xl bg-white p-6 shadow-sm"><RichText text={pg.body} /></article>
    </main>
  );
}
