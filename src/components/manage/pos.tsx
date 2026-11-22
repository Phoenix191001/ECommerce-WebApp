"use client";

import { KeepForm } from "@/components/keep-form";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { closeShift, openShift, posRefund, posSale, type PosResult } from "@/app/s/[site]/manage/pos-actions";
import { usePT } from "@/components/manage/panel-lang";

type Prod = { id: string; variant?: string; key: string; name: string; price: number; barcode: string; sku: string; stock: number };

const money = (n: number, c: string) => new Intl.NumberFormat("en-PK", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

type Queued = { id: string; at: string; lines: { id: string; variant?: string; qty: number }[]; tendered: number; total: number; error?: string };

/** F-85: sales rung up without a connection wait in this browser until they can be sent. */
function useOfflineQueue(site: string, enabled: boolean) {
  const key = `pos_queue_${site}`;
  const [queue, setQueue] = useState<Queued[]>([]);
  const [online, setOnline] = useState(true);
  const busy = useRef(false);
  const save = useCallback((q: Queued[]) => { localStorage.setItem(key, JSON.stringify(q)); setQueue(q); }, [key]);
  const load = useCallback((): Queued[] => { try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; } }, [key]);
  const sync = useCallback(async () => {
    if (!enabled || busy.current || !navigator.onLine) return;
    busy.current = true;
    try {
      for (const q of load()) {
        if (q.error) continue;
        try {
          const r = await posSale(site, q.lines, q.tendered, { id: q.id, at: q.at });
          const rest = load().filter((x) => x.id !== q.id);
          save(r.error ? [...rest, { ...q, error: r.error }] : rest);
        } catch {
          break; // still offline
        }
      }
    } finally {
      busy.current = false;
    }
  }, [enabled, load, save, site]);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => { setQueue(load()); setOnline(navigator.onLine); sync(); }, 0);
    const up = () => { setOnline(true); sync(); };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const iv = setInterval(sync, 20000);
    // Keep the POS page and its scripts so it can open without a connection.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    return () => { clearTimeout(t); clearInterval(iv); window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [enabled, load, sync]);
  const add = (q: Omit<Queued, "id" | "at">) => save([...load(), { ...q, id: crypto.randomUUID(), at: new Date().toISOString() }]);
  const drop = (id: string) => save(load().filter((x) => x.id !== id));
  const retry = (id: string) => { save(load().map((x) => (x.id === id ? { ...x, error: undefined } : x))); sync(); };
  return { queue, online, add, drop, retry, sync };
}

export function PosScreen({ site, products, currency, taxRate, barcode, trackStock, receiptBase, refunds, offline = false }: {
  site: string; products: Prod[]; currency: string; taxRate: number; barcode: boolean; trackStock: boolean; receiptBase: string | null; refunds: boolean; offline?: boolean;
}) {
  const T = usePT();
  const oq = useOfflineQueue(site, offline);
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
      const sale = lines.map((l) => ({ id: l.p.id, variant: l.p.variant, qty: l.qty }));
      const queueIt = () => {
        oq.add({ lines: sale, tendered: cash, total });
        setMsg({ ok: `📴 Offline: sale saved on this device. Change due: ${money(cash - total, currency)}. It will be sent when the connection is back.` });
        setTicket({}); setTendered("");
      };
      if (offline && !navigator.onLine) { queueIt(); scanRef.current?.focus(); return; }
      try {
        const r = await posSale(site, sale, cash);
        setMsg(r);
        if (!r.error) { setTicket({}); setTendered(""); }
      } catch {
        if (offline) queueIt();
        else setMsg({ error: "Couldn't reach the server. Check the connection and try again." });
      }
      scanRef.current?.focus();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {offline && (!oq.online || oq.queue.length > 0) && (
        <div className={`lg:col-span-2 rounded-xl px-4 py-2 text-sm ${oq.online ? "bg-sky-50 text-sky-900" : "bg-amber-100 text-amber-900"}`}>
          {!oq.online && <b>📴 You&apos;re offline. Keep selling; sales are saved on this device. </b>}
          {oq.queue.length > 0 && (
            <span>
              {oq.queue.filter((q) => !q.error).length} sale(s) waiting to sync.{" "}
              {oq.online && <button onClick={() => oq.sync()} className="font-semibold underline">{T("Sync now")}</button>}
            </span>
          )}
          {oq.queue.filter((q) => q.error).map((q) => (
            <p key={q.id} className="mt-1 text-rose-700">
              ⚠️ Sale of {money(q.total, currency)} at {new Date(q.at).toLocaleTimeString()} couldn&apos;t sync: {T(q.error ?? "")}{" "}
              <button onClick={() => oq.retry(q.id)} className="underline">{T("Retry")}</button> · <button onClick={() => confirm("Discard this sale record?") && oq.drop(q.id)} className="underline">{T("Discard")}</button>
            </p>
          ))}
        </div>
      )}
      <div className="space-y-3">
        <form onSubmit={onScan}>
          <input
            ref={scanRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={barcode ? T("Scan a barcode or type to search…") : T("Search products…")}
            className="w-full rounded-xl border-2 border-emerald-300 bg-white px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none"
            aria-label={T("Scan or search")}
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
          <h2 className="mb-3 font-semibold">{T("🧾 Current sale")}</h2>
          {lines.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">{T("Scan or tap products to add them.")}</p> : (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto text-sm">
              {lines.map((l) => (
                <li key={l.p.key} className="flex items-center gap-2 py-2">
                  <span className="flex-1 truncate">{l.p.name}</span>
                  <button onClick={() => add(l.p.key, -1)} className="h-7 w-7 rounded-md border" aria-label={T("Decrease")}>−</button>
                  <span className="w-6 text-center">{l.qty}</span>
                  <button onClick={() => add(l.p.key)} className="h-7 w-7 rounded-md border" aria-label={T("Increase")}>+</button>
                  <span className="w-20 text-right font-medium">{money(l.p.price * l.qty, currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between"><dt>{T("Subtotal")}</dt><dd>{money(subtotal, currency)}</dd></div>
            {tax > 0 && <div className="flex justify-between"><dt>Tax ({taxRate}%)</dt><dd>{money(tax, currency)}</dd></div>}
            <div className="flex justify-between text-xl font-bold"><dt>{T("Total")}</dt><dd className="text-emerald-700">{money(total, currency)}</dd></div>
          </dl>
          <label className="mt-3 block text-sm font-medium">{T("Cash received")}
            <input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-lg" />
          </label>
          <div className="mt-2 flex flex-wrap gap-1">
            {[total, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
              <button key={v} onClick={() => setTendered(String(v))} className="rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">{money(v, currency)}</button>
            ))}
          </div>
          {cash >= total && total > 0 && <p className="mt-2 text-lg font-semibold text-emerald-700">Change: {money(cash - total, currency)}</p>}
          <button onClick={complete} disabled={pending || !lines.length || cash < total || total <= 0} className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-lg font-bold text-white shadow disabled:opacity-40">
            {pending ? T("Completing…") : T("Complete sale")}
          </button>
          {msg?.error && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{T(msg.error)}</p>}
          {msg?.ok && (
            <div role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {T(msg.ok)}
              {receiptBase && msg.number && <a href={`${receiptBase}/${msg.number}`} target="_blank" className="ml-2 font-semibold underline">{T("🖨️ Print receipt")}</a>}
            </div>
          )}
        </div>
        {refunds && <RefundBox site={site} />}
      </div>
    </div>
  );
}

function RefundBox({ site }: { site: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<PosResult | undefined, FormData>(posRefund.bind(null, site), undefined);
  return (
    <details className="rounded-2xl bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-semibold">{T("↩️ Refund")}</summary>
      <KeepForm action={a} className="mt-3 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <input name="number" placeholder={T("Order #")} inputMode="numeric" required className="rounded-lg border border-slate-300 px-3 py-2" />
          <input name="amount" placeholder={T("Amount")} inputMode="numeric" required className="rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        {s?.needsPin && <input name="pin" type="password" inputMode="numeric" placeholder={T("Manager PIN")} autoFocus className="w-full rounded-lg border-2 border-amber-400 px-3 py-2" />}
        {s?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{T(s.error)}</p>}
        {s?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{T(s.ok)}</p>}
        <button className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white" disabled={p}>{p ? T("Refunding…") : T("Refund cash")}</button>
      </KeepForm>
    </details>
  );
}

export function OpenShiftForm({ site }: { site: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<PosResult | undefined, FormData>(openShift.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-3">
      <label className="block text-sm font-medium">{T("Opening cash in the drawer")}
        <input name="openingCash" inputMode="numeric" required autoFocus className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-lg" />
      </label>
      {s?.error && <p className="text-sm text-rose-600">{T(s.error)}</p>}
      <button className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 font-bold text-white" disabled={p}>{p ? T("Opening…") : T("Open shift")}</button>
    </KeepForm>
  );
}

export function CloseShiftForm({ site, currency }: { site: string; currency: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<PosResult | undefined, FormData>(closeShift.bind(null, site), undefined);
  if (s?.report) {
    const r = s.report;
    return (
      <div className="space-y-1 text-sm">
        <p className="font-semibold">{T("Shift report")}</p>
        <p>Opening cash: {money(r.openingCash, currency)}</p>
        <p>Cash sales: {money(r.cashSales, currency)}</p>
        <p>Cash refunds: −{money(r.cashRefunds, currency)}</p>
        <p className="font-semibold">Expected: {money(r.expected, currency)}</p>
        <p className="font-semibold">Counted: {money(r.counted, currency)}</p>
        <p className={`text-base font-bold ${r.difference === 0 ? "text-emerald-700" : "text-rose-600"}`}>Difference: {money(r.difference, currency)}</p>
        <div className="mt-2 flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="rounded-lg border px-3 py-1">{T("🖨️ Print report")}</button>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-slate-800 px-3 py-1 font-semibold text-white">{T("Done")}</button>
        </div>
      </div>
    );
  }
  return (
    <KeepForm action={a} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="font-medium">{T("Counted cash")}<input name="countedCash" inputMode="numeric" required className="ml-2 w-28 rounded-lg border border-slate-300 px-2 py-1.5" /></label>
      <button className="rounded-lg bg-slate-800 px-3 py-1.5 font-semibold text-white" disabled={p}>{T("Close shift")}</button>
      {s?.error && <p className="w-full text-rose-600">{T(s.error)}</p>}
    </KeepForm>
  );
}
