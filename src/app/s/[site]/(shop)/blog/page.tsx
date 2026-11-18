import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { storePrefs } from "@/lib/store-prefs";

export const metadata = { title: "Blog" };

export default async function Blog({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-40"]) notFound();
  const { t } = await storePrefs(store);
  const posts = await (await storeModels(store)).Page.find({ kind: "post", published: true }).sort({ createdAt: -1 }).limit(50).lean();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-4xl font-extrabold">📝 {t.blog}</h1>
      {posts.length === 0 ? <p className="text-slate-600">No posts yet.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <li key={String(p._id)} className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
              <p className="text-xs text-slate-500">{new Date(p.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium" })}</p>
              <Link href={`${store.base}/blog/${p.slug}`} className="mt-1 block text-lg font-bold hover:underline">{p.title}</Link>
              {p.excerpt && <p className="mt-1 text-sm text-slate-600">{p.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
