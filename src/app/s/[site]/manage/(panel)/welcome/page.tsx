import Link from "next/link";
import { storeModels, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { FEATURE_MAP, STARTER_PACK } from "@/lib/features";
import { Card, btnTealCls } from "@/components/admin/ui";
import { BrandingForm, ProductEditor, SettingsForm } from "@/components/manage/forms";
import { markOnboarding, ownerStarterPack } from "../../manage-actions";

export const metadata = { title: "Setup wizard" };

const STEPS = [
  { id: "brand", label: "Brand", icon: "🎨" },
  { id: "product", label: "First product", icon: "📦" },
  { id: "shipping", label: "Delivery & tax", icon: "🚚" },
  { id: "features", label: "Features", icon: "🧩" },
  { id: "launch", label: "Launch", icon: "🚀" },
] as const;

export default async function Wizard({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ step?: string }> }) {
  const { site } = await params;
  const { step } = await searchParams;
  const store = await requireStore(site);
  await requireStaff(store, "settings");
  const done = new Set(store.onboarding.done);
  const m = await storeModels(store);
  if ((await m.Product.estimatedDocumentCount()) > 0) done.add("product");
  const current = STEPS.find((s) => s.id === step)?.id ?? STEPS.find((s) => !done.has(s.id))?.id ?? "launch";
  const idx = STEPS.findIndex((s) => s.id === current);
  const b = `${store.base}/manage`;
  const next = STEPS[idx + 1];
  const nextLink = next ? `${b}/welcome?step=${next.id}` : b;
  const categories = await m.Product.distinct("category", { category: { $ne: "" } });
  const starterOn = STARTER_PACK.filter((id) => store.planFeatures.includes(id));

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Setup wizard</p>
        <h1 className="text-2xl font-bold">Let's get {store.name} ready to sell</h1>
        <p className="mt-1 text-sm text-white/85">Five short steps. You can skip any step and come back later from your dashboard.</p>
        <ol className="mt-5 grid grid-cols-5 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <Link href={`${b}/welcome?step=${s.id}`} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-medium transition ${s.id === current ? "bg-white text-emerald-700 shadow" : "bg-white/10 hover:bg-white/20"}`}>
                <span className="text-lg">{done.has(s.id) ? "✅" : s.icon}</span>
                <span className="hidden sm:block">{i + 1}. {s.label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {current === "brand" && (
        <Card title="🎨 Make it yours" accent="emerald">
          <p className="mb-4 text-sm text-slate-600">Your store name and color appear on every page. Pick a color and watch the preview change.</p>
          <BrandingForm site={site} name={store.name} color={store.branding.primaryColor} tagline={store.branding.tagline} logoUrl={store.branding.logoUrl} canColor={!!store.features["F-15"]} uploadUrl={`${store.base}/manage/upload`} storeId={store.id} />
        </Card>
      )}
      {current === "product" && (
        <Card title="📦 Add your first product" accent="sky">
          {done.has("product") ? (
            <p className="text-sm text-slate-600">✅ You already have products. <Link href={`${b}/products`} className="text-emerald-700 underline">Manage products</Link> or continue.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-600">Just a name and a price are enough to start. You can add photos with image links and fill in the rest later.</p>
              <ProductEditor site={site} categories={categories} features={store.features} uploadUrl={`${store.base}/manage/upload`} storeId={store.id} />
            </>
          )}
        </Card>
      )}
      {current === "shipping" && (
        <Card title="🚚 Delivery, tax, and contact" accent="amber">
          <p className="mb-4 text-sm text-slate-600">Customers see delivery and tax at checkout before they pay. You can change these any time in Settings.</p>
          <SettingsForm site={site} s={{ currency: store.currency, ...store.settings }} f={store.features} />
        </Card>
      )}
      {current === "features" && (
        <Card title="🧩 Choose your features" accent="violet">
          <p className="text-sm text-slate-600">
            Your store comes with a <b>starter pack</b> of features most shops need. Apply it with one click, then fine-tune on the{" "}
            <Link href={`${b}/features`} className="text-emerald-700 underline">Features</Link> page.
          </p>
          <ul className="my-4 grid gap-1 text-sm sm:grid-cols-2">
            {starterOn.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <span className={store.toggles[id] ? "text-emerald-600" : "text-slate-300"}>{store.toggles[id] ? "●" : "○"}</span>
                {FEATURE_MAP[id].name}
              </li>
            ))}
          </ul>
          <form action={ownerStarterPack.bind(null, site)}><button className={btnTealCls}>✨ Turn on the starter pack</button></form>
        </Card>
      )}
      {current === "launch" && (
        <Card title="🚀 You're ready" accent="rose">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Open your store and look around: <a href={store.base || "/"} target="_blank" className="font-semibold text-emerald-700 underline">view store ↗</a></li>
            <li>Place a test order with cash on delivery, then find it under <Link href={`${b}/orders`} className="text-emerald-700 underline">Orders</Link> and mark it confirmed.</li>
            <li>Share your store link with customers on WhatsApp and social media.</li>
          </ol>
          <form action={markOnboarding.bind(null, site, "launch")} className="mt-5"><button className={btnTealCls}>🎉 Finish setup</button></form>
        </Card>
      )}

      <div className="flex justify-between text-sm">
        {idx > 0 ? <Link href={`${b}/welcome?step=${STEPS[idx - 1].id}`} className="text-slate-600 hover:underline">← Back</Link> : <span />}
        <Link href={nextLink} className="font-semibold text-emerald-700 hover:underline">{next ? `Skip to ${next.label} →` : "Go to dashboard →"}</Link>
      </div>
    </>
  );
}
