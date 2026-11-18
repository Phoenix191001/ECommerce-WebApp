"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart, setCartQty } from "@/app/s/[site]/shop-actions";
import type { CartView } from "@/lib/cart";
import type { Dict } from "@/lib/i18n";

const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

/** Header cart button. With F-20 on it opens a slide-out mini cart; otherwise it links to the cart page. */
export function CartButton({ cart, base, site, currency, drawer, L }: { cart: CartView; base: string; site: string; currency: string; drawer: boolean; L: Dict }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => drawer && setOpen(true);
    window.addEventListener("cart:open", h);
    return () => window.removeEventListener("cart:open", h);
  }, [drawer]);
  const label = (
    <>
      <span aria-hidden>🛒</span> {L.cart}
      <span className="rounded-full bg-white/25 px-1.5 text-xs font-bold">{cart.count}</span>
    </>
  );
  if (!drawer)
    return <Link href={`${base}/cart`} className="btn-brand !px-3 !py-1.5" aria-label={`Cart, ${cart.count} items`}>{label}</Link>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-brand !px-3 !py-1.5" aria-label={`Cart, ${cart.count} items`}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end rtl:justify-start" role="dialog" aria-modal="true" aria-label="Your cart">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="bg-brand-gradient flex items-center justify-between px-5 py-4 text-white">
              <h2 className="text-lg font-semibold">{L.yourCart} ({cart.count})</h2>
              <button onClick={() => setOpen(false)} aria-label="Close cart" className="rounded-lg px-2 text-2xl leading-none hover:bg-white/20">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cart.items.length === 0 ? (
                <p className="py-12 text-center text-slate-500">{L.cartEmpty}</p>
              ) : (
                <ul className="space-y-4">
                  {cart.items.map((i) => (
                    <li key={i.key} className="flex gap-3">
                      <div className="bg-brand-soft flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg text-2xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : "🛍️"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.name}</p>
                        {i.variantName && <p className="text-xs text-slate-500">{i.variantName}</p>}
                        <p className="text-sm text-slate-600">{money(i.price, currency)}{i.rule && <span className="ms-1 text-xs text-emerald-600">({i.rule})</span>}</p>
                        <Qty site={site} lineKey={i.key} qty={i.qty} L={L} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3 border-t border-slate-200 px-5 py-4">
              <div className="flex justify-between font-semibold"><span>{L.subtotal}</span><span>{money(cart.subtotal, currency)}</span></div>
              <Link href={`${base}/checkout`} onClick={() => setOpen(false)} className={`btn-brand w-full ${cart.items.length ? "" : "pointer-events-none opacity-50"}`}>
                {L.checkout}
              </Link>
              <Link href={`${base}/cart`} onClick={() => setOpen(false)} className="block text-center text-sm text-slate-600 hover:underline">{L.viewCart}</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Qty({ site, lineKey, qty, L }: { site: string; lineKey: string; qty: number; L: Dict }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (n: number) => start(async () => { await setCartQty(site, lineKey, n); router.refresh(); });
  return (
    <div className="mt-1 inline-flex items-center gap-2 text-sm">
      <button disabled={pending} onClick={() => set(qty - 1)} className="h-7 w-7 rounded-md border border-slate-300 hover:bg-slate-50" aria-label="Decrease quantity">−</button>
      <span className="w-6 text-center" aria-live="polite">{qty}</span>
      <button disabled={pending} onClick={() => set(qty + 1)} className="h-7 w-7 rounded-md border border-slate-300 hover:bg-slate-50" aria-label="Increase quantity">+</button>
      <button disabled={pending} onClick={() => set(0)} className="ms-2 text-xs text-rose-600 hover:underline">{L.remove}</button>
    </div>
  );
}

export function AddToCart({ site, product, variant, disabled, full, L }: { site: string; product: string; variant?: string; disabled?: boolean; full?: boolean; L: Dict }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const router = useRouter();
  return (
    <div className={full ? "space-y-2" : ""}>
      <button
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await addToCart(site, product, 1, variant);
            setMsg(r ?? null);
            router.refresh();
            if (!r?.error) window.dispatchEvent(new Event("cart:open"));
          })
        }
        className={`btn-brand ${full ? "w-full !py-3 text-base" : "w-full !py-2 !text-xs"}`}
      >
        {disabled ? L.outOfStock : pending ? L.adding : L.addToCart}
      </button>
      {msg?.error && <p role="alert" className="mt-1 text-xs text-rose-600">{msg.error}</p>}
    </div>
  );
}
