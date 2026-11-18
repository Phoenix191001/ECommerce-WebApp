import Link from "next/link";
import { DESCRIPTIONS, FEATURES, FEATURE_MAP, GROUP_LABELS, IMPLEMENTED, STARTER_PACK, unlocks, type FeatureGroup } from "@/lib/features";
import { GuideSearch } from "@/components/guide-search";

export const metadata = { title: "Feature guide and tutorials" };

const RECIPES: { goal: string; icon: string; ids: string[]; tip: string }[] = [
  { goal: "Sell online with cash on delivery", icon: "💵", ids: ["F-01", "F-29", "F-23"], tip: "Set your delivery fee in Settings. Customers pay the courier." },
  { goal: "Run a sale with discount codes", icon: "🏷️", ids: ["F-27", "F-21"], tip: "Create codes under Discounts. Shoppers enter them in the cart." },
  { goal: "Let customers sign in and save favorites", icon: "💖", ids: ["F-22", "F-10", "F-04"], tip: "Accounts unlock wishlists, reviews, and order history." },
  { goal: "Sell in a physical shop", icon: "🏬", ids: ["F-17", "F-34", "F-35", "F-36", "F-38", "F-37", "F-39"], tip: "Add cashiers under Staff, then open the POS from the panel." },
  { goal: "Offer free delivery over an amount", icon: "🚚", ids: ["F-29", "F-58"], tip: "Set the threshold in Settings. The cart shows how much more to spend." },
  { goal: "Use your own domain name", icon: "🌐", ids: ["F-89"], tip: "Add the domain under Settings and copy the DNS record to your domain provider." },
  { goal: "Keep customers informed", icon: "📧", ids: ["F-41", "F-51", "F-52"], tip: "Customers get emails, a tracking page, and a printable invoice." },
  { goal: "Chat with shoppers on WhatsApp", icon: "💬", ids: ["F-54"], tip: "Add your WhatsApp number in Settings." },
];

const TUTORIALS = [
  {
    who: "Platform admin",
    icon: "🛡️",
    color: "from-indigo-600 to-violet-600",
    steps: [
      "Open /admin. The first visit creates your Super Admin account, then asks you to set up an authenticator app.",
      "Check Plans. Starter and Pro are ready; tick or untick the features each plan includes.",
      "Create a store under New store. It gets its own database and the starter pack of features.",
      "Create the owner setup link on the store's page and send it to the owner.",
      "Use the switches on the store's page to turn features on or off. Lock any switch the owner shouldn't change.",
    ],
  },
  {
    who: "Store owner",
    icon: "🧑‍💼",
    color: "from-emerald-600 to-teal-600",
    steps: [
      "Open your setup link and choose a password, or sign up at /start.",
      "Follow the setup wizard: brand, first product, delivery and tax, features, launch.",
      "Watch for new orders on your dashboard. Confirm, ship, and mark them delivered from Orders.",
      "Add managers and cashiers under Staff. Cashiers only see the POS.",
      "Turn on more features any time under Features. The list explains what each one does.",
    ],
  },
  {
    who: "Shopper",
    icon: "🛍️",
    color: "from-rose-500 to-orange-500",
    steps: [
      "Browse or search the store, then tap Add to cart.",
      "Open the cart, add a discount code if you have one, and press Checkout.",
      "Enter your contact and delivery details and choose cash on delivery.",
      "You'll see an order page you can bookmark, and get an email if the store sends them.",
      "Use Track order with your order number and email to check progress any time.",
    ],
  },
];

export default function GuidePage() {
  const starter = new Set(STARTER_PACK);
  const groups = (Object.keys(GROUP_LABELS) as FeatureGroup[]).map((g) => ({ g, label: GROUP_LABELS[g], features: FEATURES.filter((f) => f.group === g) }));
  const pill = (id: string) => (
    <a key={id} href={`#${id}`} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
      <span className="font-mono">{id}</span> {FEATURE_MAP[id]?.name}
    </a>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Link href="/" className="text-sm text-white/80 hover:text-white">← Home</Link>
          <h1 className="mt-3 text-4xl font-extrabold">📘 Feature guide</h1>
          <p className="mt-2 max-w-2xl text-white/90">
            New here? Start with the tutorial for your role. Already know your way around? Jump to the feature map to see what every switch does and what it needs.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2 text-sm">
            <a href="#tutorials" className="rounded-full bg-white/15 px-4 py-1.5 backdrop-blur hover:bg-white/25">🎓 Tutorials</a>
            <a href="#recipes" className="rounded-full bg-white/15 px-4 py-1.5 backdrop-blur hover:bg-white/25">🧪 Recipes</a>
            <a href="#how" className="rounded-full bg-white/15 px-4 py-1.5 backdrop-blur hover:bg-white/25">🔗 How switches work</a>
            <a href="#map" className="rounded-full bg-white/15 px-4 py-1.5 backdrop-blur hover:bg-white/25">🗺️ Feature map</a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section id="tutorials">
          <h2 className="mb-1 text-2xl font-bold">🎓 Tutorials for first-timers</h2>
          <p className="mb-5 text-sm text-slate-600">Five steps each. Pick the one that matches you.</p>
          <div className="grid gap-5 md:grid-cols-3">
            {TUTORIALS.map((t) => (
              <article key={t.who} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className={`bg-gradient-to-r ${t.color} px-5 py-4 text-white`}>
                  <p className="text-2xl">{t.icon}</p>
                  <h3 className="text-lg font-bold">{t.who}</h3>
                </div>
                <ol className="space-y-3 p-5 text-sm">
                  {t.steps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-xs font-bold text-white`}>{i + 1}</span>
                      <span className="text-slate-700">{s}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <section id="recipes">
          <h2 className="mb-1 text-2xl font-bold">🧪 Recipes: what to turn on for common goals</h2>
          <p className="mb-5 text-sm text-slate-600">Turn these on in order. The switch will offer to turn on anything else that's needed.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {RECIPES.map((r) => (
              <div key={r.goal} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold">{r.icon} {r.goal}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{r.ids.map(pill)}</div>
                <p className="mt-2 text-xs text-slate-500">{r.tip}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-2xl font-bold">🔗 How switches work</h2>
          <ul className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <li><b>Needs:</b> a feature only works when everything it needs is on. Example: Wishlist (F-10) needs Customer accounts (F-22).</li>
            <li><b>Unlocks:</b> turning a feature on makes the features listed under “Unlocks” available.</li>
            <li><b>Turning off</b> hides the feature and blocks it, but keeps its data. Turn it back on and everything returns.</li>
            <li><b>Plans</b> decide which switches a store owner can use. The platform admin can also <b>lock</b> a switch.</li>
            <li><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Starter pack</span> features are on for new stores.</li>
            <li><span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Coming soon</span> features can be switched on now and start working when they're released.</li>
          </ul>
        </section>

        <section id="map">
          <h2 className="mb-1 text-2xl font-bold">🗺️ Feature map</h2>
          <p className="mb-5 text-sm text-slate-600">All {FEATURES.length} features, with what each needs and what it unlocks. {IMPLEMENTED.size} are available now.</p>
          <GuideSearch />
          <div className="space-y-8" id="feature-list">
            {groups.map(({ g, label, features }) => (
              <div key={g} data-group>
                <h3 className="mb-3 text-lg font-bold text-indigo-900">{label}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {features.map((f) => {
                    const u = unlocks(f.id);
                    return (
                      <article key={f.id} id={f.id} data-search={`${f.id} ${f.name} ${DESCRIPTIONS[f.id]}`.toLowerCase()} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm target:ring-2 target:ring-violet-500">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 font-mono text-xs text-slate-600">{f.id}</span>
                          <h4 className="font-semibold">{f.name}</h4>
                          {starter.has(f.id) && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Starter pack</span>}
                          {f.defaultOn && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800">On by default</span>}
                          {!IMPLEMENTED.has(f.id) && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">Coming soon</span>}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{DESCRIPTIONS[f.id]}</p>
                        <div className="mt-2 space-y-1 text-xs">
                          <p className="flex flex-wrap items-center gap-1"><span className="font-semibold text-slate-500">Needs:</span> {f.requires.length ? f.requires.map(pill) : <span className="text-slate-400">nothing</span>}</p>
                          {u.length > 0 && <p className="flex flex-wrap items-center gap-1"><span className="font-semibold text-slate-500">Unlocks:</span> {u.map(pill)}</p>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
