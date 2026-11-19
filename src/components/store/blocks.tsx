import Link from "next/link";
import type { StoreContext } from "@/lib/tenant";
import { storeModels } from "@/lib/tenant";
import { visibleFilter } from "@/lib/pricing";
import { youtubeId, type Block } from "@/lib/blocks";
import type { Dict } from "@/lib/i18n";
import type { DisplayCurrency } from "@/lib/money";
import { ProductCard } from "./product-card";
import { RichText } from "./rich-text";

/** F-116: render a built page. */
export async function Blocks({ blocks, store, site, L, cur }: { blocks: Block[]; store: StoreContext; site: string; L: Dict; cur?: DisplayCurrency }) {
  const b = store.base;
  const href = (u: string) => (u.startsWith("/") ? `${b}${u === "/" ? "" : u}` || "/" : u);
  const m = await storeModels(store);
  const lists = await Promise.all(
    blocks.map((x) =>
      x.type === "products"
        ? m.Product.find({ ...visibleFilter(store.features), ...(x.category ? { category: x.category } : {}), ...(x.tag ? { tags: x.tag } : {}) }).sort({ createdAt: -1 }).limit(x.limit).lean()
        : Promise.resolve([]),
    ),
  );
  return (
    <div className="space-y-10">
      {blocks.map((x, i) => {
        switch (x.type) {
          case "hero":
            return (
              <section key={i} className="bg-brand-gradient relative overflow-hidden text-white" style={x.image ? { backgroundImage: `linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)),url("${encodeURI(x.image)}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                <div className="mx-auto max-w-6xl px-4 py-16">
                  {x.title && <h1 className="text-4xl font-extrabold sm:text-5xl">{x.title}</h1>}
                  {x.text && <p className="mt-3 max-w-xl text-lg text-white/90">{x.text}</p>}
                  {x.button && x.link && <Link href={href(x.link)} className="mt-6 inline-block rounded-xl bg-white px-5 py-2.5 font-semibold text-slate-900 shadow hover:bg-slate-100">{x.button}</Link>}
                </div>
              </section>
            );
          case "text":
            return <div key={i} className="mx-auto max-w-3xl px-4"><RichText text={x.text} /></div>;
          case "image":
            return (
              <figure key={i} className="mx-auto max-w-5xl px-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {x.link ? <Link href={href(x.link)}><img src={x.url} alt={x.caption} className="w-full rounded-3xl object-cover" /></Link> : <img src={x.url} alt={x.caption} className="w-full rounded-3xl object-cover" />}
                {x.caption && <figcaption className="mt-2 text-center text-sm text-slate-500">{x.caption}</figcaption>}
              </figure>
            );
          case "products":
            return (
              <section key={i} className="mx-auto max-w-6xl px-4">
                {x.title && <h2 className="mb-4 text-2xl font-bold">{x.title}</h2>}
                <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {lists[i].map((p) => <ProductCard key={String(p._id)} p={p} site={site} base={b} currency={store.currency} f={store.features} L={L} cur={cur} />)}
                </ul>
              </section>
            );
          case "banner": {
            const cls = x.tone === "dark" ? "bg-slate-900 text-white" : x.tone === "light" ? "bg-white text-slate-900 shadow-sm" : "bg-brand text-white";
            const inner = <p className={`mx-auto max-w-6xl rounded-2xl px-4 py-4 text-center text-lg font-semibold ${cls}`}>{x.text}</p>;
            return <div key={i} className="px-4">{x.link ? <Link href={href(x.link)}>{inner}</Link> : inner}</div>;
          }
          case "columns": {
            const cols = x.items.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter((c) => c[0]).slice(0, 4);
            return (
              <section key={i} className={`mx-auto grid max-w-6xl gap-4 px-4 ${["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"][Math.min(cols.length, 4)]}`}>
                {cols.map(([t, d], j) => <div key={j} className="rounded-2xl bg-white p-5 shadow-sm"><p className="font-bold">{t}</p>{d && <p className="mt-1 text-sm text-slate-600">{d}</p>}</div>)}
              </section>
            );
          }
          case "faq": {
            const qa = x.items.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter((c) => c[0]);
            return (
              <section key={i} className="mx-auto max-w-3xl px-4">
                {x.title && <h2 className="mb-4 text-2xl font-bold">{x.title}</h2>}
                <div className="space-y-2">{qa.map(([q, a], j) => <details key={j} className="rounded-2xl bg-white p-4 shadow-sm"><summary className="cursor-pointer font-semibold">{q}</summary>{a && <p className="mt-2 text-slate-600">{a}</p>}</details>)}</div>
              </section>
            );
          }
          case "video": {
            const id = youtubeId(x.url);
            return id ? (
              <div key={i} className="mx-auto max-w-4xl px-4">
                <div className="aspect-video overflow-hidden rounded-3xl"><iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title="Video" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full" /></div>
              </div>
            ) : null;
          }
        }
      })}
    </div>
  );
}
