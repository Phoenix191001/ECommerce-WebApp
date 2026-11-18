import Link from "next/link";
import { headers } from "next/headers";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { ensurePlans, salesEmail } from "@/lib/plans";
import { storeUrl } from "@/lib/subdomain";
import { StartForm } from "@/components/start-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start your store" };

export default async function StartPage() {
  await ensurePlans();
  const { Plan } = platformModels(await platformDb());
  const plans = (await Plan.find().sort({ priceMonthly: 1, name: -1 }).lean()).map((p) => ({
    id: String(p._id), name: p.name, description: p.description, price: p.priceMonthly, features: p.features.length,
    contactOnly: !!p.requiresActivation || p.priceMonthly > 0,
  }));
  // Example of where a store lives: a subdomain, or /s/<name> while on a vercel.app address.
  const host = (await headers()).get("host") ?? "";
  const url = storeUrl("SUB");
  const example = (url.startsWith("/") ? `${host}${url}` : url).replace(/^https?:\/\//, "");
  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-700 via-fuchsia-600 to-rose-500 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-medium text-white/80 hover:text-white">← Back</Link>
        <h1 className="mt-4 text-4xl font-extrabold text-white">Start your online store</h1>
        <p className="mt-2 text-white/85">Three quick steps. No credit card needed for free plans.</p>
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-2xl">
          <StartForm plans={plans} addressExample={example} salesEmail={salesEmail()} />
        </div>
      </div>
    </main>
  );
}
