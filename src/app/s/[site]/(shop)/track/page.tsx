import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { TrackForm } from "@/components/store/forms";
import { storePrefs } from "@/lib/store-prefs";

export const metadata = { title: "Track your order" };

export default async function TrackPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-51"]) notFound();
  const { t } = await storePrefs(store);
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-4xl">📦</p>
        <h1 className="mt-2 text-2xl font-bold">{t.trackAnOrder}</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">{t.trackSub}</p>
        <TrackForm site={site} t={t} />
      </div>
    </main>
  );
}
