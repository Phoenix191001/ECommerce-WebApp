import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requireStore, storeModels, formatMoney } from "@/lib/tenant";
import { storePrefs } from "@/lib/store-prefs";
import { fromPrice, totalStock, visibleFilter } from "@/lib/pricing";
import { toggleCompare } from "../../shop-actions";

export const metadata = { title: "Compare" };

// F-11 product comparison (up to 4, kept in a cookie).
export default async function Compare({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const f = store.features;
  if (!f["F-11"]) notFound();
  const { t } = await storePrefs(store);
  const ids = ((await cookies()).get(`cmp_${store.id}`)?.value ?? "").split(",").filter((x) => Types.ObjectId.isValid(x));
  const found = ids.length ? await (await storeModels(store)).Product.find({ $and: [visibleFilter(f), { _id: { $in: ids } }] }).lean() : [];
  const ps = ids.map((id) => found.find((p) => String(p._id) === id)).filter((p): p is (typeof found)[number] => !!p);
  const rows: [string, (p: (typeof ps)[number]) => React.ReactNode][] = [
    ["Price", (p) => <b className="text-brand">{formatMoney(fromPrice(p, { features: f }), store.currency)}</b>],
    ["Brand", (p) => p.brand || "—"],
    ["Category", (p) => p.category || "—"],
    ...(f["F-04"] ? [["Rating", (p: (typeof ps)[number]) => (p.ratingCount ? `${p.ratingAvg.toFixed(1)} ★ (${p.ratingCount})` : "—")] as [string, (p: (typeof ps)[number]) => React.ReactNode]] : []),
    ...(f["F-17"] ? [["Availability", (p: (typeof ps)[number]) => (totalStock(p) > 0 ? t.inStock : t.outOfStock)] as [string, (p: (typeof ps)[number]) => React.ReactNode]] : []),
    ...(f["F-02"] ? [["Options", (p: (typeof ps)[number]) => (p.variants?.length ? p.variants.map((v) => v.name).join(", ") : "—")] as [string, (p: (typeof ps)[number]) => React.ReactNode]] : []),
    ...(f["F-111"] ? [["Warranty", (p: (typeof ps)[number]) => (p.warrantyMonths ? `${p.warrantyMonths} months` : "—")] as [string, (p: (typeof ps)[number]) => React.ReactNode]] : []),
  ];
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">⚖️ {t.compareProducts}</h1>
      {ps.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm">{t.compareEmpty}</p> : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-32" />
                {ps.map((p) => (
                  <th key={String(p._id)} className="p-4 text-start align-top">
                    <div className="bg-brand-soft mb-2 flex aspect-square w-32 items-center justify-center overflow-hidden rounded-xl text-4xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : "🛍️"}
                    </div>
                    <Link href={`${store.base}/p/${p.slug}`} className="font-semibold hover:underline">{p.name}</Link>
                    <form action={toggleCompare.bind(null, site, String(p._id))}><button className="mt-1 text-xs font-normal text-rose-600 hover:underline">{t.remove}</button></form>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(([label, fn]) => (
                <tr key={label}><th className="p-4 text-start font-medium text-slate-500">{label}</th>{ps.map((p) => <td key={String(p._id)} className="p-4">{fn(p)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
