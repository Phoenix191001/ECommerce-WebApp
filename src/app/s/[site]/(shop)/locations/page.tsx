import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { storePrefs } from "@/lib/store-prefs";

export const metadata = { title: "Our shops" };

// F-88 store locator.
export default async function Locations({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const locs = store.settings.locations;
  if (!store.features["F-88"] || !locs.length) notFound();
  const { t } = await storePrefs(store);
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-4xl font-extrabold">📍 {t.locations}</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {locs.map((l, i) => (
          <li key={i} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-lg font-bold">{l.name}</p>
            <p className="mt-1 text-sm text-slate-600">{l.address}</p>
            {l.hours && <p className="text-sm text-slate-600">🕒 {l.hours}</p>}
            {l.phone && <p className="text-sm"><a href={`tel:${l.phone}`} className="text-brand">📞 {l.phone}</a></p>}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name} ${l.address}`)}`} target="_blank" rel="noopener" className="btn-brand mt-3 !py-1.5">🗺️ Directions</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
