"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAddress, askQuestion, confirmCustomerTwoFactor, notifyWhenBack, openTicket, replyTicket, requestReturn,
  setLanguage, setTheme, subscribe, type ShopState,
} from "@/app/s/[site]/shop-actions";
import { KeepForm } from "@/components/keep-form";
import { AddToCart } from "./cart";
import { field } from "./forms";
import { fill, type Dict } from "@/lib/i18n";

const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

function Msg({ s }: { s: ShopState }) {
  if (s?.error) return <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{s.error}</p>;
  if (s?.ok) return <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{s.ok}</p>;
  return null;
}

// ---------- Product page ----------

type V = { id: string; name: string; price: number; stock: number };

/** F-02 variant picker with price, stock and add-to-cart; F-14 back-in-stock signup when sold out. */
export function BuyBox({
  site, product, variants, optionLabel, basePrice, baseStock, trackStock, lowAt, currency, alerts, L,
}: {
  site: string; product: string; variants: V[]; optionLabel: string; basePrice: number; baseStock: number;
  trackStock: boolean; lowAt: number; currency: string; alerts: boolean; L: Dict;
}) {
  const [vid, setVid] = useState<string | undefined>(variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id);
  const v = variants.find((x) => x.id === vid);
  const price = v ? v.price : basePrice;
  const stock = v ? v.stock : baseStock;
  const out = trackStock && stock <= 0;
  const low = trackStock && stock > 0 && stock <= lowAt;
  return (
    <div className="space-y-4">
      <p className="text-3xl font-bold text-brand" aria-live="polite">{money(price, currency)}</p>
      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{L.chooseOption} {optionLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setVid(x.id)}
                aria-pressed={x.id === vid}
                className={`rounded-xl border-2 px-3 py-1.5 text-sm transition ${x.id === vid ? "border-brand bg-brand-soft font-semibold" : "border-slate-200 bg-white"} ${trackStock && x.stock <= 0 ? "opacity-50 line-through" : ""}`}
              >
                {x.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {trackStock && (
        <p className={`text-sm font-medium ${out ? "text-rose-600" : low ? "text-amber-600" : "text-emerald-600"}`}>
          {out ? L.outOfStock : low ? fill(L.onlyLeft, { n: stock }) : L.inStock}
        </p>
      )}
      <AddToCart site={site} product={product} variant={vid} disabled={out} full L={L} />
      {out && alerts && <StockAlertForm key={vid ?? "p"} site={site} product={product} variant={vid} L={L} />}
    </div>
  );
}

function StockAlertForm({ site, product, variant, L }: { site: string; product: string; variant?: string; L: Dict }) {
  const [s, a, p] = useActionState<ShopState, FormData>(notifyWhenBack.bind(null, site, product, variant), undefined);
  return (
    <KeepForm action={a} className="space-y-2 rounded-xl bg-slate-50 p-3">
      <div className="flex gap-2">
        <input name="email" type="email" required placeholder="you@example.com" aria-label="Email" className={field} />
        <button className="btn-brand !px-3 !py-2 whitespace-nowrap" disabled={p}>🔔 {L.notifyMe}</button>
      </div>
      <Msg s={s} />
    </KeepForm>
  );
}

/** F-66 countdown to the end of a flash sale. */
export function Countdown({ until, label }: { until: string; label: string }) {
  const end = new Date(until).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  if (now === null) return null;
  const left = Math.max(0, end - now);
  if (!left) return null;
  const d = Math.floor(left / 86400_000), h = Math.floor(left / 3600_000) % 24, m = Math.floor(left / 60_000) % 60, s = Math.floor(left / 1000) % 60;
  const cell = (n: number, u: string) => (
    <span className="flex flex-col items-center rounded-lg bg-white/20 px-2 py-1"><b className="font-mono text-lg">{String(n).padStart(2, "0")}</b><span className="text-[10px]">{u}</span></span>
  );
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-3 text-white" role="timer">
      <span className="text-sm font-semibold">⚡ {label}</span>
      <div className="flex gap-1.5">{d > 0 && cell(d, "d")}{cell(h, "h")}{cell(m, "m")}{cell(s, "s")}</div>
    </div>
  );
}

export function QuestionForm({ site, product, L }: { site: string; product: string; L: Dict }) {
  const [s, a, p] = useActionState<ShopState, FormData>(askQuestion.bind(null, site, product), undefined);
  return (
    <KeepForm action={a} className="space-y-2">
      <input name="name" required placeholder="Your name" aria-label="Your name" className={field} />
      <textarea name="question" required rows={2} placeholder="Your question" aria-label="Your question" className={field} />
      <Msg s={s} />
      <button className="btn-brand" disabled={p}>{L.askQuestion}</button>
    </KeepForm>
  );
}

// ---------- Layout ----------

export function PrefToggles({ site, lang, dark, showLang, showDark, L }: { site: string; lang: string; dark: boolean; showLang: boolean; showDark: boolean; L: Dict }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center gap-1">
      {showLang && (
        <button disabled={pending} onClick={() => start(async () => { await setLanguage(site, lang === "ur" ? "en" : "ur"); router.refresh(); })} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" aria-label="Change language">
          🌐 {L.language}
        </button>
      )}
      {showDark && (
        <button disabled={pending} onClick={() => start(async () => { await setTheme(site, dark ? "light" : "dark"); router.refresh(); })} className="rounded-lg px-2 py-1 text-sm hover:bg-slate-100" aria-label={dark ? L.lightMode : L.darkMode} title={dark ? L.lightMode : L.darkMode}>
          {dark ? "☀️" : "🌙"}
        </button>
      )}
    </div>
  );
}

export function NewsletterForm({ site, L }: { site: string; L: Dict }) {
  const [s, a, p] = useActionState<ShopState, FormData>(subscribe.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="w-full max-w-sm space-y-2">
      <p className="text-sm font-semibold text-slate-700">📬 {L.newsletter}</p>
      <div className="flex gap-2">
        <input name="email" type="email" required placeholder="you@example.com" aria-label="Email for newsletter" className={field} />
        <button className="btn-brand !py-2" disabled={p}>{L.subscribe}</button>
      </div>
      <Msg s={s} />
    </KeepForm>
  );
}

/** F-119: offer a code when the pointer leaves the page at checkout (once per visit). */
export function ExitIntent({ code, L }: { code: string; L: Dict }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const key = `exit_${code}`;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setShow(true);
      }
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [code]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={L.exitTitle}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <p className="text-xl font-bold">{L.exitTitle}</p>
        <p className="mt-2 text-sm text-slate-600">{L.exitText}</p>
        <p className="bg-brand-soft mx-auto mt-3 inline-block rounded-xl px-4 py-2 font-mono text-2xl font-bold tracking-widest text-brand">{code}</p>
        <button onClick={() => setShow(false)} className="mt-4 block w-full text-sm text-slate-500 hover:underline">{L.exitClose}</button>
      </div>
    </div>
  );
}

// ---------- Account ----------

export function AddressForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(addAddress.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="grid gap-2 sm:grid-cols-2">
      <input name="label" placeholder="Label (Home, Office)" aria-label="Label" className={field} />
      <input name="phone" placeholder="Phone" aria-label="Phone" className={field} />
      <input name="address" required placeholder="Address" aria-label="Address" className={`${field} sm:col-span-2`} />
      <input name="city" required placeholder="City" aria-label="City" className={field} />
      <button className="btn-brand" disabled={p}>Save address</button>
      <div className="sm:col-span-2"><Msg s={s} /></div>
    </KeepForm>
  );
}

export function ReturnForm({ site, order, items, allowExchange, allowCredit }: { site: string; order: number; items: { name: string; qty: number }[]; allowExchange: boolean; allowCredit: boolean }) {
  const [s, a, p] = useActionState<ShopState, FormData>(requestReturn.bind(null, site, order), undefined);
  return (
    <KeepForm action={a} className="space-y-3 text-sm">
      <ul className="space-y-1">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-center justify-between gap-2">
            <span>{i.name}</span>
            <label className="flex items-center gap-1 text-xs text-slate-500">Return
              <input name={`qty_${idx}`} type="number" min="0" max={i.qty} defaultValue={0} className="w-16 rounded-lg border border-slate-300 px-2 py-1" aria-label={`Quantity of ${i.name} to return`} />
              of {i.qty}
            </label>
          </li>
        ))}
      </ul>
      <select name="type" className={field} aria-label="What would you like?">
        <option value="refund">Refund my money</option>
        {allowExchange && <option value="exchange">Exchange for another size/color</option>}
        {allowCredit && <option value="credit">Store credit</option>}
      </select>
      <textarea name="reason" required rows={2} placeholder="Why are you returning it?" aria-label="Reason" className={field} />
      <Msg s={s} />
      <button className="btn-brand" disabled={p}>{p ? "Sending…" : "Request return"}</button>
    </KeepForm>
  );
}

export function TicketForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(openTicket.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <input name="subject" required placeholder="Subject" aria-label="Subject" className={field} />
        <input name="order" placeholder="Order # (optional)" aria-label="Order number" className={field} />
      </div>
      <textarea name="text" required rows={3} placeholder="How can we help?" aria-label="Message" className={field} />
      <Msg s={s} />
      <button className="btn-brand" disabled={p}>{p ? "Sending…" : "Send"}</button>
    </KeepForm>
  );
}

export function TicketReply({ site, id }: { site: string; id: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(replyTicket.bind(null, site, id), undefined);
  return (
    <KeepForm action={a} className="mt-2 flex gap-2">
      <input name="text" required placeholder="Reply…" aria-label="Reply" className={field} />
      <button className="btn-brand !py-2" disabled={p}>Send</button>
      <Msg s={s} />
    </KeepForm>
  );
}

export function TwoFactorConfirm({ site }: { site: string }) {
  const [s, a, p] = useActionState<ShopState, FormData>(confirmCustomerTwoFactor.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-2">
      <input name="code" inputMode="numeric" maxLength={7} required placeholder="6-digit code" aria-label="6-digit code" className={`${field} text-center font-mono tracking-widest`} />
      <Msg s={s} />
      <button className="btn-brand" disabled={p}>Confirm</button>
    </KeepForm>
  );
}

/** F-09: remember this product in the shopper's recently-viewed list (cookie, newest first, max 12). */
export function RecordView({ storeId, product }: { storeId: string; product: string }) {
  useEffect(() => {
    const name = `rv_${storeId}`;
    const cur = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1] ?? "";
    const list = [product, ...decodeURIComponent(cur).split(",").filter((x) => x && x !== product)].slice(0, 12);
    document.cookie = `${name}=${encodeURIComponent(list.join(","))}; path=/; max-age=2592000; samesite=lax`;
  }, [storeId, product]);
  return null;
}
