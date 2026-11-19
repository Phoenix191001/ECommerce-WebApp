import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import type { ToggleState } from "@/lib/features";
import { showMoney, type DisplayCurrency } from "@/lib/money";
import { fromPrice, hasVariants, saleActive, totalStock } from "@/lib/pricing";
import { AddToCart } from "./cart";

type P = {
  _id: unknown; name: string; slug: string; price: number; compareAtPrice?: number | null; images?: string[];
  stock: number; ratingAvg?: number; ratingCount?: number; variants?: { _id: unknown; name: string; price?: number | null; stock: number }[];
  salePrice?: number | null; saleEndsAt?: Date | null;
};

export function ProductCard({ p, site, base, currency, f, L, cur }: { p: P; site: string; base: string; currency: string; f: ToggleState; L: Dict; cur?: DisplayCurrency }) {
  const ctx = { features: f };
  const variants = !!f["F-02"] && hasVariants(p);
  const out = f["F-17"] && totalStock(p) <= 0;
  const price = fromPrice(p, ctx);
  const was = saleActive(p, ctx) ? p.price : p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : null;
  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`${base}/p/${p.slug}`} className="relative block">
        <div className="bg-brand-soft aspect-square overflow-hidden">
          {p.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl" aria-hidden>🛍️</div>
          )}
        </div>
        {was && <span className="absolute start-2 top-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">{L.sale}</span>}
        {out && <span className="absolute end-2 top-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">{L.soldOut}</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`${base}/p/${p.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">{p.name}</Link>
        {f["F-04"] && (p.ratingCount ?? 0) > 0 && (
          <p className="text-xs text-amber-500">{"★".repeat(Math.round(p.ratingAvg ?? 0))}<span className="text-slate-400"> ({p.ratingCount})</span></p>
        )}
        <p className="mt-auto text-sm">
          {variants && <span className="text-xs text-slate-500">{L.from} </span>}
          <b className="text-brand">{showMoney(price, currency, cur)}</b>
          {was && <s className="ms-2 text-xs text-slate-400">{showMoney(was, currency, cur)}</s>}
        </p>
        {variants ? (
          <Link href={`${base}/p/${p.slug}`} className="btn-brand w-full !py-2 !text-xs">{L.chooseOption}</Link>
        ) : (
          <AddToCart site={site} product={String(p._id)} disabled={out} L={L} />
        )}
      </div>
    </li>
  );
}
