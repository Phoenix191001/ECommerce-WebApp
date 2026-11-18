"use client";

import { useActionState, useState } from "react";
import { addReview, applyCode, customerLogin, placeOrder, register, trackOrder, type ShopState } from "@/app/s/[site]/shop-actions";

export const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ring-brand";

function Msg({ s }: { s: ShopState }) {
  if (s?.error) return <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{s.error}</p>;
  if (s?.ok) return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{s.ok}</p>;
  return null;
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}

export function CodeForm({ site, current }: { site: string; current?: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(applyCode.bind(null, site), undefined);
  return (
    <form action={a} className="space-y-2">
      <div className="flex gap-2">
        <input name="code" defaultValue={current} placeholder="Discount code" className={`${field} uppercase`} aria-label="Discount code" />
        <button className="rounded-xl border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50" disabled={p}>{current ? "Update" : "Apply"}</button>
      </div>
      <Msg s={s} />
    </form>
  );
}

type CheckoutProps = {
  site: string;
  defaults: { name: string; email: string; phone: string; address: string; city: string };
  pickup: boolean;
  pickupAddress: string;
  methods: { id: "cod" | "card" | "wallet"; label: string; note: string; available: boolean }[];
  totalLabel: string;
};

export function CheckoutForm({ site, defaults, pickup, pickupAddress, methods, totalLabel }: CheckoutProps) {
  const [s, a, p] = useActionState<ShopState, FormData>(placeOrder.bind(null, site), undefined);
  const [delivery, setDelivery] = useState<"shipping" | "pickup">("shipping");
  const first = methods.find((m) => m.available)?.id;
  return (
    <form action={a} className="space-y-6">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><span className="bg-brand flex h-7 w-7 items-center justify-center rounded-full text-sm text-white">1</span> Contact</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Full name"><input name="name" required defaultValue={defaults.name} autoComplete="name" className={field} /></L>
          <L label="Phone"><input name="phone" required defaultValue={defaults.phone} autoComplete="tel" className={field} placeholder="03xx xxxxxxx" /></L>
        </div>
        <L label="Email"><input name="email" type="email" required defaultValue={defaults.email} autoComplete="email" className={field} /></L>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><span className="bg-brand flex h-7 w-7 items-center justify-center rounded-full text-sm text-white">2</span> Delivery</h2>
        {pickup && (
          <div className="grid grid-cols-2 gap-2">
            {(["shipping", "pickup"] as const).map((d) => (
              <label key={d} className={`cursor-pointer rounded-xl border-2 p-3 text-sm ${delivery === d ? "border-brand bg-brand-soft" : "border-slate-200"}`}>
                <input type="radio" name="delivery" value={d} checked={delivery === d} onChange={() => setDelivery(d)} className="sr-only" />
                <b>{d === "shipping" ? "🚚 Deliver to me" : "🏬 Pick up"}</b>
                {d === "pickup" && pickupAddress && <span className="block text-xs text-slate-600">{pickupAddress}</span>}
              </label>
            ))}
          </div>
        )}
        {!pickup && <input type="hidden" name="delivery" value="shipping" />}
        {delivery === "shipping" && (
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <L label="Address"><input name="address" required defaultValue={defaults.address} autoComplete="street-address" className={field} /></L>
            <L label="City"><input name="city" required defaultValue={defaults.city} autoComplete="address-level2" className={field} /></L>
          </div>
        )}
        <L label="Note for the store (optional)"><input name="note" className={field} /></L>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><span className="bg-brand flex h-7 w-7 items-center justify-center rounded-full text-sm text-white">3</span> Payment</h2>
        <div className="space-y-2">
          {methods.map((m) => (
            <label key={m.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft ${m.available ? "cursor-pointer border-slate-200" : "cursor-not-allowed border-slate-100 opacity-50"}`}>
              <input type="radio" name="payment" value={m.id} defaultChecked={m.id === first} disabled={!m.available} className="mt-1" />
              <span><b>{m.label}</b><span className="block text-xs text-slate-600">{m.note}</span></span>
            </label>
          ))}
        </div>
      </section>
      <Msg s={s} />
      <button className="btn-brand w-full !py-3 text-base" disabled={p || !first}>{p ? "Placing order…" : `Place order · ${totalLabel}`}</button>
    </form>
  );
}

export function LoginForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(customerLogin.bind(null, site), undefined);
  return (
    <form action={a} className="space-y-3">
      <L label="Email"><input name="email" type="email" required autoComplete="email" className={field} /></L>
      <L label="Password"><input name="password" type="password" required autoComplete="current-password" className={field} /></L>
      <Msg s={s} />
      <button className="btn-brand w-full" disabled={p}>{p ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(register.bind(null, site), undefined);
  return (
    <form action={a} className="space-y-3">
      <L label="Name"><input name="name" required autoComplete="name" className={field} /></L>
      <L label="Email"><input name="email" type="email" required autoComplete="email" className={field} /></L>
      <L label="Password"><input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} /></L>
      <Msg s={s} />
      <button className="btn-brand w-full" disabled={p}>{p ? "Creating…" : "Create account"}</button>
    </form>
  );
}

export function TrackForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(trackOrder.bind(null, site), undefined);
  return (
    <form action={a} className="space-y-3">
      <L label="Order number"><input name="number" required inputMode="numeric" placeholder="1001" className={field} /></L>
      <L label="Email used for the order"><input name="email" type="email" required className={field} /></L>
      <Msg s={s} />
      <button className="btn-brand w-full" disabled={p}>{p ? "Looking up…" : "Track order"}</button>
    </form>
  );
}

export function ReviewForm({ site, product }: { site: string; product: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(addReview.bind(null, site, product), undefined);
  const [rating, setRating] = useState(5);
  return (
    <form action={a} className="space-y-3">
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? "text-amber-400" : "text-slate-300"}`}>★</button>
        ))}
      </div>
      <textarea name="text" rows={3} placeholder="What did you think?" className={field} />
      <Msg s={s} />
      <button className="btn-brand" disabled={p}>{p ? "Posting…" : "Post review"}</button>
    </form>
  );
}

/** Rendered only when the server saw no consent cookie (F-79). */
export function CookieBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const accept = () => {
    document.cookie = "cc=1; path=/; max-age=31536000; samesite=lax";
    setHidden(true);
  };
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl">
      <span className="flex-1">🍪 We use cookies to keep your cart and sign-in working, and to improve the store.</span>
      <button onClick={accept} className="btn-brand !py-1.5">Accept</button>
    </div>
  );
}
