import Link from "next/link";
import { requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { DESCRIPTIONS, FEATURES, GROUP_LABELS, IMPLEMENTED, type FeatureGroup } from "@/lib/features";
import { Badge, Card, btnTealCls } from "@/components/admin/ui";
import { ToggleBoard } from "@/components/admin/toggles";
import { ownerStarterPack, ownerToggle } from "../../manage-actions";
import { panelPrefs } from "@/lib/panel-i18n";

export const metadata = { title: "Features" };

export default async function Features({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  const { t: T } = await panelPrefs(store);
  await requireStaff(store, "features");
  const groups = (Object.keys(GROUP_LABELS) as FeatureGroup[]).map((g) => ({ group: g, label: GROUP_LABELS[g], features: FEATURES.filter((f) => f.group === g) }));
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{T("Features")}</h1>
        <p className="text-sm text-slate-500">
          {T("Turn features on or off for your store. Changes show on your storefront within seconds. Your")} <b>{store.planName}</b> plan includes {store.planFeatures.length} of {FEATURES.length} features.
        </p>
      </div>
      <Card accent="emerald" title={T("How features work")} actions={<form action={ownerStarterPack.bind(null, site)}><button className={btnTealCls}>{T("✨ Turn on starter pack")}</button></form>}>
        <ul className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          <li>{T("🔗 Some features need others first. Turning one on offers to switch on what it needs.")}</li>
          <li>🔒 <b>Locked</b> {T("switches are set by the platform. Contact support to change them.")}</li>
          <li>💎 <b>Not in plan</b> {T("features need a bigger plan.")}</li>
          <li><Badge tone="sky">{T("Coming soon")}</Badge> {T("features can be switched on now and start working when released.")}</li>
        </ul>
        <p className="mt-3 text-sm"><Link href="/guide" target="_blank" className="font-medium text-emerald-700 hover:underline">{T("📘 Read the full feature guide ↗")}</Link></p>
      </Card>
      <Card accent="indigo">
        <ToggleBoard
          groups={groups}
          toggles={store.toggles}
          effective={store.features}
          locked={store.locked}
          planFeatures={store.planFeatures}
          descriptions={DESCRIPTIONS}
          implemented={[...IMPLEMENTED]}
          onToggle={ownerToggle.bind(null, site)}
        />
      </Card>
    </>
  );
}
