"use client";

import { useState, useTransition } from "react";
import { FONTS, PRESETS, RADII, contrastText, fontHref, themeVars, type FontId, type Radius, type Theme } from "@/lib/theme";
import { saveDesign } from "@/app/s/[site]/manage/growth-actions";
import { ImageField } from "./image-field";
import { usePT } from "./panel-lang";

type ColorKey = "bg" | "surface" | "text" | "muted" | "border" | "header" | "headerText" | "footer" | "footerText" | "button" | "buttonText" | "link" | "sale" | "announce" | "announceText" | "heroFrom" | "heroTo" | "heroText";

const COLOR_GROUPS: { title: string; items: [ColorKey, string][] }[] = [
  { title: "Page", items: [["bg", "Background"], ["surface", "Cards and boxes"], ["text", "Text"], ["muted", "Light text"], ["border", "Lines and borders"]] },
  { title: "Header and footer", items: [["header", "Header"], ["headerText", "Header text"], ["footer", "Footer"], ["footerText", "Footer text"], ["announce", "Announcement bar"], ["announceText", "Announcement text"]] },
  { title: "Buttons and links", items: [["button", "Buttons"], ["buttonText", "Button text"], ["link", "Links and prices"], ["sale", "Sale badge"]] },
  { title: "Top banner", items: [["heroFrom", "Banner colour 1"], ["heroTo", "Banner colour 2"], ["heroText", "Banner text"]] },
];

export function DesignEditor({ site, initial, storeName, uploadUrl, storeId, saved }: { site: string; initial: Theme; storeName: string; uploadUrl: string; storeId: string; saved: boolean }) {
  const T = usePT();
  const [t, setT] = useState<Theme>(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => setT((x) => ({ ...x, [k]: v, preset: k === "preset" ? (v as string) : "custom" }));
  const pick = (id: string) => setT((x) => ({ ...x, ...PRESETS[id].theme, preset: id, heroImage: x.heroImage, heroTitle: x.heroTitle, heroSubtitle: x.heroSubtitle, heroButton: x.heroButton, bgImage: x.bgImage, favicon: x.favicon }));
  const save = (reset = false) => start(async () => { setMsg(null); setMsg((await saveDesign(site, t, reset)) ?? null); });
  const fonts = fontHref(t);
  const label = "text-xs font-medium text-slate-600";
  const sel = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-5">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">{T("Ready-made themes")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(PRESETS).map(([id, p]) => (
              <button key={id} type="button" onClick={() => pick(id)} className={`overflow-hidden rounded-lg border text-start text-xs ${t.preset === id ? "border-teal-600 ring-2 ring-teal-500/40" : "border-slate-200 hover:border-slate-400"}`}>
                <div className="flex h-10" aria-hidden>
                  <span className="flex-1" style={{ background: p.theme.header }} />
                  <span className="flex-1" style={{ background: p.theme.bg }} />
                  <span className="flex-1" style={{ background: p.theme.button }} />
                  <span className="flex-1" style={{ background: `linear-gradient(135deg, ${p.theme.heroFrom}, ${p.theme.heroTo})` }} />
                </div>
                <p className="px-2 py-1 font-medium text-slate-700">{T(p.name)}</p>
              </button>
            ))}
          </div>
          {t.preset === "custom" && <p className="mt-1 text-xs text-slate-500">{T("Custom: you've changed a theme. Pick a theme again to start over.")}</p>}
        </section>

        {COLOR_GROUPS.map((g) => (
          <details key={g.title} open={g.title === "Page"} className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">🎨 {T(g.title)}</summary>
            <div className="grid grid-cols-2 gap-3 px-3 pb-3">
              {g.items.map(([k, name]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="color" value={t[k]} onChange={(e) => set(k, e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-300" />
                  <span className={label}>{T(name)}<span className="block font-mono text-[10px] text-slate-400">{t[k]}</span></span>
                </label>
              ))}
              {g.title === "Buttons and links" && (
                <button type="button" onClick={() => set("buttonText", contrastText(t.button))} className="col-span-2 text-start text-xs text-teal-700 hover:underline">{T("Pick a readable button text colour for me")}</button>
              )}
            </div>
          </details>
        ))}

        <details open className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">🔤 {T("Fonts and shape")}</summary>
          <div className="grid grid-cols-2 gap-3 px-3 pb-3">
            <label className="space-y-1"><span className={label}>{T("Headings font")}</span>
              <select value={t.headingFont} onChange={(e) => set("headingFont", e.target.value as FontId)} className={sel}>{Object.entries(FONTS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}</select></label>
            <label className="space-y-1"><span className={label}>{T("Text font")}</span>
              <select value={t.font} onChange={(e) => set("font", e.target.value as FontId)} className={sel}>{Object.entries(FONTS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}</select></label>
            <label className="space-y-1"><span className={label}>{T("Corners")}</span>
              <select value={t.radius} onChange={(e) => set("radius", e.target.value as Radius)} className={sel}>
                {(Object.keys(RADII) as Radius[]).map((r) => <option key={r} value={r}>{T({ none: "Square", small: "Slightly rounded", medium: "Rounded", large: "Very rounded", pill: "Pill" }[r])}</option>)}
              </select></label>
            <label className="space-y-1"><span className={label}>{T("Products per row")}</span>
              <select value={t.grid} onChange={(e) => set("grid", Number(e.target.value) as 2 | 3 | 4)} className={sel}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="space-y-1"><span className={label}>{T("Page width")}</span>
              <select value={t.width} onChange={(e) => set("width", e.target.value as Theme["width"])} className={sel}><option value="boxed">{T("Boxed")}</option><option value="wide">{T("Wide")}</option></select></label>
            <label className="space-y-1"><span className={label}>{T("Product cards")}</span>
              <select value={t.cardStyle} onChange={(e) => set("cardStyle", e.target.value as Theme["cardStyle"])} className={sel}>
                <option value="shadow">{T("Shadow")}</option><option value="border">{T("Outline")}</option><option value="flat">{T("Flat")}</option></select></label>
          </div>
        </details>

        <details open className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">🖼️ {T("Top banner and images")}</summary>
          <div className="space-y-3 px-3 pb-3">
            <label className="block space-y-1"><span className={label}>{T("Banner title")}</span>
              <input value={t.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} placeholder={storeName} maxLength={80} className={sel} /></label>
            <label className="block space-y-1"><span className={label}>{T("Banner text")}</span>
              <input value={t.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} placeholder={T("Uses your tagline when empty")} maxLength={200} className={sel} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1"><span className={label}>{T("Banner button")}</span>
                <input value={t.heroButton} onChange={(e) => set("heroButton", e.target.value)} placeholder={T("e.g. Shop now")} maxLength={30} className={sel} /></label>
              <label className="space-y-1"><span className={label}>{T("Banner text position")}</span>
                <select value={t.heroAlign} onChange={(e) => set("heroAlign", e.target.value as Theme["heroAlign"])} className={sel}><option value="start">{T("Side")}</option><option value="center">{T("Centre")}</option></select></label>
            </div>
            <div className="space-y-1"><span className={label}>{T("Banner photo (optional)")}</span>
              <ImageField name="heroImage" single initial={t.heroImage ? [t.heroImage] : []} uploadUrl={uploadUrl} folder={`stores/${storeId}/design`} onChange={(u) => set("heroImage", u[0] ?? "")} /></div>
            <div className="space-y-1"><span className={label}>{T("Page background picture (optional)")}</span>
              <ImageField name="bgImage" single initial={t.bgImage ? [t.bgImage] : []} uploadUrl={uploadUrl} folder={`stores/${storeId}/design`} onChange={(u) => set("bgImage", u[0] ?? "")} /></div>
            <div className="space-y-1"><span className={label}>{T("Browser tab icon (optional, square)")}</span>
              <ImageField name="favicon" single initial={t.favicon ? [t.favicon] : []} uploadUrl={uploadUrl} folder={`stores/${storeId}/design`} onChange={(u) => set("favicon", u[0] ?? "")} /></div>
          </div>
        </details>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
          <button type="button" onClick={() => save()} disabled={pending} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50">{pending ? T("Saving…") : T("Save design")}</button>
          {saved && <button type="button" onClick={() => { if (confirm(T("Go back to the plain default look?"))) save(true); }} disabled={pending} className="text-sm text-slate-500 hover:underline">{T("Reset to default")}</button>}
          {msg?.ok && <span role="status" className="text-sm text-emerald-700">✅ {T(msg.ok)}</span>}
          {msg?.error && <span role="alert" className="text-sm text-rose-700">{T(msg.error)}</span>}
        </div>
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <p className="mb-2 text-sm font-semibold text-slate-800">👀 {T("Live preview")} <span className="font-normal text-slate-500">{T("(not saved until you press Save)")}</span></p>
        {fonts && <link rel="stylesheet" href={fonts} />}
        <Preview t={t} name={storeName} L={T} />
      </div>
    </div>
  );
}

/** A small storefront drawn with the same CSS variables and classes the real store uses. */
function Preview({ t, name, L }: { t: Theme; name: string; L: (s: string) => string }) {
  const cols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[t.grid];
  const card = t.cardStyle === "shadow" ? "border border-slate-200 bg-white shadow-md" : t.cardStyle === "border" ? "border border-slate-200 bg-white" : "";
  const items = [["🎧", "Wireless headphones", "4,500", "5,200"], ["⌚", "Smart watch", "7,999", ""], ["👟", "Running shoes", "6,250", ""], ["🎒", "Laptop backpack", "3,100", "3,900"]].slice(0, Math.max(t.grid, 3));
  return (
    <div className={`store-themed st-card-${t.cardStyle} overflow-hidden rounded-xl border border-slate-300 text-sm shadow-lg`} style={themeVars(t) as React.CSSProperties}>
      <div className="st-announce px-3 py-1.5 text-center text-xs font-medium">{L("🎉 Free delivery this week")}</div>
      <div className="st-header flex items-center justify-between border-b px-4 py-3">
        <span className="flex items-center gap-2 font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs" style={{ background: t.button, color: t.buttonText }}>{name[0]}</span><span className="text-brand">{name}</span></span>
        <span className="flex gap-3 text-xs"><span>{L("Blog")}</span><span>{L("Sign in")}</span><span>🛒 2</span></span>
      </div>
      <div className={`st-hero relative px-6 py-10 ${t.heroAlign === "center" ? "text-center" : ""}`} style={t.heroImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url("${t.heroImage}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{L("Welcome to")}</p>
        <h3 className="text-2xl font-extrabold">{t.heroTitle || name}</h3>
        <p className="mt-1 opacity-90">{t.heroSubtitle || L("Your tagline shows here")}</p>
        {t.heroButton && <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-900">{t.heroButton}</span>}
      </div>
      <div className="p-4">
        <div className="mb-3 flex gap-2"><span className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-400">{L("Search products…")}</span></div>
        <ul className={`grid gap-3 ${cols}`}>
          {items.map(([icon, n, price, was]) => (
            <li key={n} className={`overflow-hidden rounded-2xl ${card}`}>
              <div className="relative flex aspect-square items-center justify-center text-3xl" style={{ background: `color-mix(in srgb, ${t.button} 10%, ${t.surface})` }}>
                {icon}{was && <span className="absolute start-1.5 top-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{L("Sale")}</span>}
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium text-slate-900">{L(n)}</p>
                <p className="text-xs"><b className="text-brand">Rs {price}</b> {was && <s className="text-slate-400">Rs {was}</s>}</p>
                <span className="btn-brand block rounded-lg px-2 py-1 text-center text-[11px] font-semibold">{L("Add to cart")}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="st-footer border-t px-4 py-4 text-xs">© {new Date().getFullYear()} {name} · {L("Track an order")} · {L("Blog")}</div>
    </div>
  );
}
