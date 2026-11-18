"use client";

import { KeepForm } from "@/components/keep-form";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { closeShift, openShift, posRefund, posSale, type PosResult } from "@/app/s/[site]/manage/pos-actions";

type Prod = { id: string; variant?: string; key: string; name: string; price: number; barcode: string; sku: string; stock: number };

const money = (n: number, c: string) => new Intl.NumberFormat("en-PK", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export function PosScreen({ site, products, currency, taxRate, barcode, trackStock, receiptBase, refunds }: {
  site: string; products: Prod[]; currency: string; taxRate: number; barcode: boolean; trackStock: boolean; receiptBase: string | null; refunds: boolean;
}) {
  const [ticket, setTicket] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [tendered, setTendered] = useState("");
  const [msg, setMsg] = useState<PosResult | null>(null);
  const [pending, start] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const byId = useMemo(() => new Map(products.map((p) => [p.key, p])), [products]);
  const add = (id: string, n = 1) => setTicket((t) => ({ ...t, [id]: Math.max(0, (t[id] ?? 0) + n) }));
  const lines = Object.entries(ticket).filter(([, n]) => n > 0).map(([id, qty]) => ({ p: byId.get(id)!, qty })).filter((l) => l.p);
  const subtotal = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
  const tax = Math.round((subtotal * taxRate) / 100);
  const total = subtotal + tax;
  const cash = Number(tendered) || 0;
  const shown = q ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku === q || p.barcode === q) : products;

  const onScan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = q.trim();
    const hit = products.find((p) => (p.barcode && p.barcode === code) || (p.sku && p.sku === code));
    if (hit) { add(hit.key); setQ(""); setMsg(null); }
    else if (shown.length === 1) { add(shown[0].key); setQ(""); }
    else setMsg({ error: `No product with barcode or SKU “${code}”.` });
    scanRef.current?.focus();
  };

  const complete = () =>
    start(async () => {
      const r = await posSale(site, lines.map((l) => ({ id: l.p.id, variant: l.p.variant, qty: l.qty })), cash);
      setMsg(r);
      if (!r.error) { setTicket({}); setTendered(""); }
      scanRef.current?.focus();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-3">
        <form onSubmit={onScan}>
          <input
            ref={scanRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={barcode ? "Scan a barcode or type to search…" : "Search products…"}
            className="w-full rounded-xl border-2 border-emerald-300 bg-white px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none"
            aria-label="Scan or search"
          />
        </form>
        <ul className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
          {shown.slice(0, 120).map((p) => (
            <li key={p.key}>
              <button
                onClick={() => add(p.key)}
                disabled={trackStock && p.stock - (ticket[p.key] ?? 0) <= 0}
                className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3 text-left text-sm shadow-sm transition hover:border-emerald-400 hover:shadow disabled:opacity-40"
              >
                <span className="line-clamp-2 font-medium">{p.name}</span>
                <span className="mt-auto pt-1 font-bold text-emerald-700">{money(p.price, currency)}</span>
                {trackStock && <span className="text-[11px] text-slate-500">{p.stock} in stock</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">🧾 Current sale</h2>
          {lines.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Scan or tap products to add them.</p> : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto text-sm">
              {lines.map((l) => (
                <li key={l.p.key} className="flex items-center gap-2 py-2">
                  <span className="flex-1 truncate">{l.p.name}</span>
                  <button onClick={() => add(l.p.key, -1)} className="h-7 w-7 rounded-md border" aria-label="Decrease">−</button>
                  <span className="w-6 text-center">{l.qty}</span>
                  <button onClick={() => add(l.p.key)} className="h-7 w-7 rounded-md border" aria-label="Increase">+</button>
                  <span className="w-20 text-right font-medium">{money(l.p.price * l.qty, currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(subtotal, currency)}</dd></div>
            {tax > 0 && <div className="flex justify-between"><dt>Tax ({taxRate}%)</dt><dd>{money(tax, currency)}</dd></div>}
            <div className="flex justify-between text-xl font-bold"><dt>Total</dt><dd className="text-emerald-700">{money(total, currency)}</dd></div>
          </dl>
          <label className="mt-3 block text-sm font-medium">Cash received
            <input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-lg" />
          </label>
          <div className="mt-2 flex flex-wrap gap-1">
            {[total, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
              <button key={v} onClick={() => setTendered(String(v))} className="rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">{money(v, currency)}</button>
            ))}
          </div>
          {cash >= total && total > 0 && <p className="mt-2 text-lg font-semibold text-emerald-700">Change: {money(cash - total, currency)}</p>}
          <button onClick={complete} disabled={pending || !lines.length || cash < total} className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-lg font-bold text-white shadow disabled:opacity-40">
            {pending ? "Completing…" : "Complete sale"}
          </button>
          {msg?.error && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg.error}</p>}
          {msg?.ok && (
            <div role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {msg.ok}
              {receiptBase && msg.number && <a href={`${receiptBase}/${msg.number}`} target="_blank" className="ml-2 font-semibold underline">🖨️ Print receipt</a>}
            </div>
          )}
        </div>
        {refunds && <RefundBox site={site} />}
      </div>
    </div>
  );
}

function RefundBox({ site }: { site: string }) {
  const [s, a, p] = useActionState<PosResult | undefined, FormData>(posRefund.bind(null, site), undefined);
  return (
    <details className="rounded-2xl bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-semibold">↩️ Refund</summary>
      <KeepForm action={a} className="mt-3 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <input name="number" placeholder="Order #" inputMode="numeric" required className="rounded-lg border border-slate-300 px-3 py-2" />
          <input name="amount" placeholder="Amount" inputMode="numeric" required className="rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        {s?.needsPin && <input name="pin" type="password" inputMode="numeric" placeholder="Manager PIN" autoFocus className="w-full rounded-lg border-2 border-amber-400 px-3 py-2" />}
        {s?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{s.error}</p>}
        {s?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{s.ok}</p>}
        <button className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white" disabled={p}>{p ? "Refunding…" : "Refund cash"}</button>
      </KeepForm>
    </details>
  );
}

export function OpenShiftForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<PosResult | undefined, FormData>(openShift.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-3">
      <label className="block text-sm font-medium">Opening cash in the drawer
        <input name="openingCash" inputMode="numeric" required autoFocus className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-lg" />
      </label>
      {s?.error && <p className="text-sm text-rose-600">{s.error}</p>}
      <button className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 font-bold text-white" disabled={p}>{p ? "Opening…" : "Open shift"}</button>
    </KeepForm>
  );
}

export function CloseShiftForm({ site, currency }: { site: string; currency: string }) {
  const [s, a, p] = useActionState<PosResult | undefined, FormData>(closeShift.bind(null, site), undefined);
  if (s?.report) {
    const r = s.report;
    return (
      <div className="space-y-1 text-sm">
        <p className="font-semibold">Shift report</p>
        <p>Opening cash: {money(r.openingCash, currency)}</p>
        <p>Cash sales: {money(r.cashSales, currency)}</p>
        <p>Cash refunds: −{money(r.cashRefunds, currency)}</p>
        <p className="font-semibold">Expected: {money(r.expected, currency)}</p>
        <p className="font-semibold">Counted: {money(r.counted, currency)}</p>
        <p className={`text-base font-bold ${r.difference === 0 ? "text-emerald-700" : "text-rose-600"}`}>Difference: {money(r.difference, currency)}</p>
        <div className="mt-2 flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="rounded-lg border px-3 py-1">🖨️ Print report</button>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-slate-800 px-3 py-1 font-semibold text-white">Done</button>
        </div>
      </div>
    );
  }
  return (
    <KeepForm action={a} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="font-medium">Counted cash<input name="countedCash" inputMode="numeric" required className="ml-2 w-28 rounded-lg border border-slate-300 px-2 py-1.5" /></label>
      <button className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white" disabled={p}>Close shift</button>
      {s?.error && <p className="w-full text-rose-600">{s.error}</p>}
    </KeepForm>
  );
}
