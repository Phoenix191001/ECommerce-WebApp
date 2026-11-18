import Link from "next/link";

const FEATURES = [
  { icon: "🧩", title: "122 switchable features", text: "Turn on exactly what each store needs, from wishlists to a cashier POS." },
  { icon: "🏬", title: "A store per customer", text: "Every store gets its own address, branding, and separate database." },
  { icon: "💵", title: "Built for Pakistan", text: "Cash on delivery, PKR pricing, WhatsApp ordering, and JazzCash coming soon." },
  { icon: "🧑‍💼", title: "Owner panel and POS", text: "Orders, products, discounts, staff roles, and an in-shop cashier screen." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600 text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-400/30 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <p className="mx-auto mb-4 inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-medium backdrop-blur">🛍️ Multi-Tenant Ecommerce Platform</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">Launch your online store<br />in minutes</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/90">Your own address, your own brand, and only the features you need. Add products, take cash-on-delivery orders, and run your shop counter from one place.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/start" className="rounded-xl bg-white px-6 py-3 font-semibold text-violet-700 shadow-lg hover:bg-violet-50">🚀 Start your store</Link>
            <Link href="/guide" className="rounded-xl bg-white/15 px-6 py-3 font-semibold backdrop-blur hover:bg-white/25">📘 How it works</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-5 px-6 py-16 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-3xl">{f.icon}</p>
            <h2 className="mt-3 text-lg font-bold text-slate-900">{f.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="pb-10 text-center text-sm text-slate-500">
        <Link href="/admin" className="hover:underline">Platform admin</Link> · <Link href="/guide" className="hover:underline">Feature guide</Link>
      </footer>
    </main>
  );
}
