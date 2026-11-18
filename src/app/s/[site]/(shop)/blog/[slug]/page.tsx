import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore, requireStore, storeModels } from "@/lib/tenant";
import { RichText } from "@/components/store/rich-text";

type Props = { params: Promise<{ site: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, slug } = await params;
  const store = await getStore(site);
  const p = store ? await (await storeModels(store)).Page.findOne({ slug, kind: "post", published: true }).lean() : null;
  return p ? { title: p.title, description: p.excerpt || undefined } : {};
}

export default async function Post({ params }: Props) {
  const { site, slug } = await params;
  const store = await requireStore(site);
  if (!store.features["F-40"]) notFound();
  const p = await (await storeModels(store)).Page.findOne({ slug, kind: "post", published: true }).lean();
  if (!p) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`${store.base}/blog`} className="text-sm text-slate-500 hover:underline">← Blog</Link>
      <h1 className="mt-2 text-4xl font-extrabold">{p.title}</h1>
      <p className="mb-6 text-sm text-slate-500">{new Date(p.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "long" })}</p>
      <article className="rounded-3xl bg-white p-6 shadow-sm"><RichText text={p.body} /></article>
    </main>
  );
}
