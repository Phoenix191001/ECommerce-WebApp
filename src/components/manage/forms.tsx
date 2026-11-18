"use client";

import { useActionState, useState } from "react";
import {
  addStaff, ownerSetup, refundOrder, saveBranding, saveDiscount, saveProduct, saveSettings, setCustomDomain, staffLogin,
  type MState,
} from "@/app/s/[site]/manage/manage-actions";
import { Field, FormMessage, btnTealCls, inputCls } from "@/components/admin/ui";

const tealInput = inputCls.replaceAll("indigo", "emerald");

export function StaffLoginForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<MState, FormData>(staffLogin.bind(null, site), undefined);
  return (
    <form action={a} className="space-y-4">
      <Field label="Email"><input name="email" type="email" required autoComplete="email" className={tealInput} /></Field>
      <Field label="Password"><input name="password" type="password" required autoComplete="current-password" className={tealInput} /></Field>
      <FormMessage state={s} />
      <button className={`${btnTealCls} w-full`} disabled={p}>{p ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function OwnerSetupForm({ site, token }: { site: string; token: string }) {
  const [s, a, p] = useActionState<MState, FormData>(ownerSetup.bind(null, site, token), undefined);
  return (
    <form action={a} className="space-y-4">
      <Field label="New password" hint="At least 10 characters."><input name="password" type="password" minLength={10} required autoComplete="new-password" className={tealInput} /></Field>
      <Field label="Type it again"><input name="confirm" type="password" required autoComplete="new-password" className={tealInput} /></Field>
      <FormMessage state={s} />
      <button className={`${btnTealCls} w-full`} disabled={p}>{p ? "Saving…" : "Set password and continue"}</button>
    </form>
  );
}

type P = {
  id?: string; name?: string; price?: number; compareAtPrice?: number; stock?: number; category?: string; brand?: string;
  sku?: string; barcode?: string; images?: string[]; description?: string; status?: string;
};

export function ProductEditor({ site, product, categories }: { site: string; product?: P; categories: string[] }) {
  const [s, a, p] = useActionState<MState, FormData>(saveProduct.bind(null, site, product?.id ?? null), undefined);
  return (
    <form action={a} className="space-y-4">
      <Field label="Product name"><input name="name" required defaultValue={product?.name} className={tealInput} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price"><input name="price" type="number" min="0" required defaultValue={product?.price} className={tealInput} /></Field>
        <Field label="Compare-at price" hint="Shows a sale badge when higher."><input name="compareAtPrice" type="number" min="0" defaultValue={product?.compareAtPrice ?? ""} className={tealInput} /></Field>
        <Field label="Stock"><input name="stock" type="number" min="0" step="1" defaultValue={product?.stock ?? 0} className={tealInput} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <input name="category" list="cats" defaultValue={product?.category} className={tealInput} placeholder="e.g. Phones" />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Brand"><input name="brand" defaultValue={product?.brand} className={tealInput} /></Field>
        <Field label="SKU"><input name="sku" defaultValue={product?.sku} className={tealInput} /></Field>
        <Field label="Barcode" hint="Used by the POS scanner."><input name="barcode" defaultValue={product?.barcode} className={tealInput} /></Field>
      </div>
      <Field label="Image URLs" hint="One per line. The first is the main photo.">
        <textarea name="images" rows={3} defaultValue={product?.images?.join("\n")} className={`${tealInput} font-mono text-xs`} placeholder="https://…" />
      </Field>
      <Field label="Description"><textarea name="description" rows={5} defaultValue={product?.description} className={tealInput} /></Field>
      <Field label="Visibility">
        <select name="status" defaultValue={product?.status ?? "active"} className={tealInput}>
          <option value="active">Active — shown in the store</option>
          <option value="draft">Draft — hidden</option>
        </select>
      </Field>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? "Saving…" : product?.id ? "Save changes" : "Add product"}</button>
    </form>
  );
}

export function RefundForm({ site, number, max }: { site: string; number: number; max: number }) {
  const [s, a, p] = useActionState<MState, FormData>(refundOrder.bind(null, site, number), undefined);
  return (
    <form action={a} className="space-y-3">
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <input name="amount" type="number" min="1" max={max} defaultValue={max} className={tealInput} aria-label="Refund amount" />
        <input name="reason" placeholder="Reason" className={tealInput} aria-label="Refund reason" />
      </div>
      <FormMessage state={s} />
      <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500" disabled={p}>{p ? "Refunding…" : "Refund"}</button>
    </form>
  );
}

export function DiscountForm({ site }: { site: string }) {
  const [s, a, p] = useActionState<MState, FormData>(saveDiscount.bind(null, site), undefined);
  return (
    <form action={a} className="grid gap-3 sm:grid-cols-3">
      <Field label="Code"><input name="code" required className={`${tealInput} uppercase`} placeholder="EID20" /></Field>
      <Field label="Type">
        <select name="type" className={tealInput}><option value="percent">% off</option><option value="fixed">Amount off</option></select>
      </Field>
      <Field label="Value"><input name="value" type="number" min="1" required className={tealInput} /></Field>
      <Field label="Minimum order"><input name="minSubtotal" type="number" min="0" defaultValue={0} className={tealInput} /></Field>
      <Field label="Usage limit" hint="0 = unlimited"><input name="usageLimit" type="number" min="0" defaultValue={0} className={tealInput} /></Field>
      <Field label="Expires (optional)"><input name="expiresAt" type="date" className={tealInput} /></Field>
      <div className="sm:col-span-3 space-y-2">
        <FormMessage state={s} />
        <button className={btnTealCls} disabled={p}>{p ? "Creating…" : "Create code"}</button>
      </div>
    </form>
  );
}

export function StaffForm({ site, canAddManager }: { site: string; canAddManager: boolean }) {
  const [s, a, p] = useActionState<MState, FormData>(addStaff.bind(null, site), undefined);
  const [role, setRole] = useState(canAddManager ? "manager" : "cashier");
  return (
    <form action={a} className="grid gap-3 sm:grid-cols-2">
      <Field label="Name"><input name="name" required className={tealInput} /></Field>
      <Field label="Email"><input name="email" type="email" required className={tealInput} /></Field>
      <Field label="Temporary password"><input name="password" type="text" minLength={8} required className={tealInput} /></Field>
      <Field label="Role">
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={tealInput}>
          {canAddManager && <option value="manager">Manager — catalog, orders, discounts, POS</option>}
          <option value="cashier">Cashier — POS only</option>
        </select>
      </Field>
      <Field label="Refund limit at POS" hint="Larger refunds need a manager PIN."><input name="refundLimit" type="number" min="0" defaultValue={role === "manager" ? 100000 : 500} className={tealInput} /></Field>
      {role === "manager" && <Field label="Manager PIN" hint="4–6 digits, approves large refunds."><input name="pin" inputMode="numeric" pattern="\d{4,6}" className={tealInput} /></Field>}
      <div className="sm:col-span-2 space-y-2">
        <FormMessage state={s} />
        <button className={btnTealCls} disabled={p}>{p ? "Adding…" : "Add staff member"}</button>
      </div>
    </form>
  );
}

export function BrandingForm({ site, name, color, tagline, logoUrl, canColor }: { site: string; name: string; color: string; tagline: string; logoUrl?: string | null; canColor: boolean }) {
  const [s, a, p] = useActionState<MState, FormData>(saveBranding.bind(null, site), undefined);
  const [c, setC] = useState(color);
  const [n, setN] = useState(name);
  const swatches = ["#4f46e5", "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#d97706", "#16a34a", "#0d9488", "#0284c7", "#0f172a"];
  return (
    <form action={a} className="grid gap-5 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <Field label="Store name"><input name="name" value={n} onChange={(e) => setN(e.target.value)} required className={tealInput} /></Field>
        <Field label="Tagline" hint="One line under the store name."><input name="tagline" defaultValue={tagline} className={tealInput} placeholder="Quality gadgets, delivered fast" /></Field>
        <Field label="Logo URL (optional)"><input name="logoUrl" defaultValue={logoUrl ?? ""} className={tealInput} placeholder="https://…/logo.png" /></Field>
        <div>
          <span className="text-sm font-medium text-slate-800">Brand color</span>
          {!canColor && <p className="text-xs text-amber-700">Turn on F-15 (theme switching) to change it.</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {swatches.map((sw) => (
              <button type="button" key={sw} disabled={!canColor} onClick={() => setC(sw)} aria-label={`Use ${sw}`}
                className={`h-8 w-8 rounded-full ring-offset-2 transition ${c === sw ? "ring-2 ring-slate-900" : ""}`} style={{ background: sw }} />
            ))}
            <input type="color" name="primaryColor" value={c} disabled={!canColor} onChange={(e) => setC(e.target.value)} className="h-8 w-12 cursor-pointer rounded" aria-label="Custom color" />
            {!canColor && <input type="hidden" name="primaryColor" value={c} />}
          </div>
        </div>
        <FormMessage state={s} />
        <button className={btnTealCls} disabled={p}>{p ? "Saving…" : "Save branding"}</button>
      </div>
      <div aria-hidden className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-4 py-6 text-white" style={{ background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 55%, #ec4899))` }}>
          <p className="text-[10px] uppercase tracking-widest opacity-80">Preview</p>
          <p className="text-lg font-bold">{n || "Your store"}</p>
        </div>
        <div className="space-y-2 bg-white p-4">
          <div className="h-16 rounded-lg" style={{ background: `color-mix(in srgb, ${c} 12%, white)` }} />
          <div className="h-2 w-2/3 rounded bg-slate-200" />
          <div className="rounded-lg py-1.5 text-center text-xs font-semibold text-white" style={{ background: c }}>Add to cart</div>
        </div>
      </div>
    </form>
  );
}

type S = { currency: string; shippingFlat: number; freeShippingThreshold: number; taxRate: number; whatsapp: string; announcement: string; pickupAddress: string; contactEmail: string; seoTitle: string; seoDescription: string; lowStockAt: number };

export function SettingsForm({ site, s: v, f }: { site: string; s: S; f: Record<string, boolean> }) {
  const [s, a, p] = useActionState<MState, FormData>(saveSettings.bind(null, site), undefined);
  const off = (id: string) => (f[id] ? undefined : <span className="text-amber-700">Turn on {id} to use this.</span>);
  return (
    <form action={a} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Currency">
          <select name="currency" defaultValue={v.currency} className={tealInput}>{["PKR", "USD", "AED", "GBP", "EUR", "SAR"].map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Delivery fee" hint={off("F-29") ?? "Flat fee per order."}><input name="shippingFlat" type="number" min="0" defaultValue={v.shippingFlat} className={tealInput} /></Field>
        <Field label="Free delivery over" hint={off("F-58") ?? "0 turns it off."}><input name="freeShippingThreshold" type="number" min="0" defaultValue={v.freeShippingThreshold} className={tealInput} /></Field>
        <Field label="Tax rate (%)" hint={off("F-31") ?? "Added at checkout."}><input name="taxRate" type="number" min="0" max="100" step="0.1" defaultValue={v.taxRate} className={tealInput} /></Field>
        <Field label="Low stock warning at" hint={off("F-18") ?? "Shown on your dashboard."}><input name="lowStockAt" type="number" min="0" defaultValue={v.lowStockAt} className={tealInput} /></Field>
        <Field label="Contact email"><input name="contactEmail" type="email" defaultValue={v.contactEmail} className={tealInput} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="WhatsApp number" hint={off("F-54") ?? "With country code, e.g. 923001234567."}><input name="whatsapp" defaultValue={v.whatsapp} className={tealInput} /></Field>
        <Field label="Pickup address" hint={off("F-59")}><input name="pickupAddress" defaultValue={v.pickupAddress} className={tealInput} /></Field>
      </div>
      <Field label="Announcement bar" hint={off("F-118") ?? "Shown across the top of every page. Leave empty to hide."}><input name="announcement" defaultValue={v.announcement} className={tealInput} placeholder="🎉 Eid sale: 20% off with code EID20" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SEO title" hint={off("F-75")}><input name="seoTitle" defaultValue={v.seoTitle} maxLength={70} className={tealInput} /></Field>
        <Field label="SEO description" hint={off("F-75")}><input name="seoDescription" defaultValue={v.seoDescription} maxLength={160} className={tealInput} /></Field>
      </div>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

export function DomainForm({ site, current }: { site: string; current?: string }) {
  const [s, a, p] = useActionState<MState, FormData>(setCustomDomain.bind(null, site), undefined);
  return (
    <form action={a} className="space-y-3">
      <div className="flex gap-2">
        <input name="domain" defaultValue={current} placeholder="shop.example.com" className={tealInput} aria-label="Custom domain" />
        <button className={btnTealCls} disabled={p}>{p ? "Adding…" : current ? "Change" : "Add domain"}</button>
      </div>
      <FormMessage state={s} />
    </form>
  );
}
