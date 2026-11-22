"use client";

import { FormMessage, usePT } from "@/components/manage/panel-lang";
import { KeepForm } from "@/components/keep-form";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addStaff, changeSubdomain, ownerStarterPack, ownerSetup, refundOrder, saveBranding, saveDiscount, saveProduct, saveSettings, setCustomDomain, staffLogin,
  type MState,
} from "@/app/s/[site]/manage/manage-actions";
import { Field, btnTealCls, inputCls } from "@/components/admin/ui";
import { ImageField } from "./image-field";
import { FileField } from "./file-field";

const tealInput = inputCls.replaceAll("indigo", "emerald");

export function StaffLoginForm({ site }: { site: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(staffLogin.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-4">
      <Field label={T("Email")}><input name="email" type="email" required autoComplete="email" className={tealInput} /></Field>
      <Field label={T("Password")}><input name="password" type="password" required autoComplete="current-password" className={tealInput} /></Field>
      <FormMessage state={s} />
      <button className={`${btnTealCls} w-full`} disabled={p}>{p ? T("Signing in…") : T("Sign in")}</button>
    </KeepForm>
  );
}

export function OwnerSetupForm({ site, token }: { site: string; token: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(ownerSetup.bind(null, site, token), undefined);
  return (
    <KeepForm action={a} className="space-y-4">
      <Field label={T("New password")} hint={T("At least 10 characters.")}><input name="password" type="password" minLength={10} required autoComplete="new-password" className={tealInput} /></Field>
      <Field label={T("Type it again")}><input name="confirm" type="password" required autoComplete="new-password" className={tealInput} /></Field>
      <FormMessage state={s} />
      <button className={`${btnTealCls} w-full`} disabled={p}>{p ? T("Saving…") : T("Set password and continue")}</button>
    </KeepForm>
  );
}

type P = {
  id?: string; name?: string; price?: number; compareAtPrice?: number; stock?: number; category?: string; brand?: string;
  sku?: string; barcode?: string; images?: string[]; description?: string; status?: string;
  optionNames?: string[]; variants?: { name: string; price?: number; stock: number; sku: string; barcode: string }[];
  tags?: string[]; publishAt?: string; warrantyMonths?: number; sizeGuide?: string; volumeTiers?: { minQty: number; price: number }[];
  salePrice?: number; saleEndsAt?: string; costPrice?: number; wholesalePrice?: number;
  kind?: string; digitalFile?: { url: string; name: string }; bundle?: { product: string; qty: number }[];
  customFields?: { label: string; required: boolean; maxLength: number }[]; upsells?: string[]; seller?: string;
};

type CatalogItem = { id: string; name: string; simple: boolean };

/** F-13: pick the products (and how many of each) a bundle contains. */
function BundleEditor({ initial, catalog }: { initial: { product: string; qty: number }[]; catalog: CatalogItem[] }) {
  const T = usePT();
  const [rows, setRows] = useState(initial.length ? initial : [{ product: "", qty: 1 }]);
  const parts = catalog.filter((c) => c.simple);
  const set = (i: number, v: Partial<{ product: string; qty: number }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <div className="space-y-2">
      <input type="hidden" name="bundle" value={JSON.stringify(rows.filter((r) => r.product))} />
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <select value={r.product} onChange={(e) => set(i, { product: e.target.value })} className={`${tealInput} flex-1`} aria-label={`Bundle item ${i + 1}`}>
            <option value="">{T("Choose a product…")}</option>
            {parts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" min={1} max={99} value={r.qty} onChange={(e) => set(i, { qty: Math.max(1, Number(e.target.value) || 1) })} className={`${tealInput} w-20`} aria-label={T("Quantity")} />
          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="px-2 text-rose-600" aria-label={T("Remove item")}>✕</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows((x) => [...x, { product: "", qty: 1 }])} className="text-sm font-medium text-emerald-700 hover:underline">{T("➕ Add item")}</button>
      <p className="text-xs text-slate-500">Selling one bundle takes these items out of stock. Products with variants can&apos;t be bundle items.</p>
    </div>
  );
}

/** F-57: products to suggest with this one. */
function UpsellPicker({ initial, catalog, self }: { initial: string[]; catalog: CatalogItem[]; self?: string }) {
  const T = usePT();
  const [sel, setSel] = useState(new Set(initial));
  const [q, setQ] = useState("");
  const list = catalog.filter((c) => c.id !== self && (!q || c.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 60);
  return (
    <div className="space-y-2">
      <input type="hidden" name="upsells" value={[...sel].join(",")} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Search products…")} className={tealInput} aria-label={T("Search products to suggest")} />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {list.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sel.has(c.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else if (n.size < 8) n.add(c.id); return n; })} className="accent-emerald-600" />
            {c.name}
          </label>
        ))}
        {!list.length && <p className="text-xs text-slate-500">{T("No products found.")}</p>}
      </div>
      <p className="text-xs text-slate-500">{sel.size}/8 chosen. Shown in the cart and at checkout. If you pick none, the store suggests items from the same category.</p>
    </div>
  );
}

/** Value for <input type="datetime-local"> in Pakistan time. */
export const toLocalInput = (d?: string | Date | null) => {
  if (!d) return "";
  const t = new Date(new Date(d).getTime() + 5 * 3600_000); // Asia/Karachi is UTC+5 all year
  return t.toISOString().slice(0, 16);
};

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-slate-200 p-4 [&_summary]:cursor-pointer">
      <summary className="text-sm font-semibold text-slate-800">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export function ProductEditor({ site, product, categories, features = {}, uploadUrl, storeId, catalog = [], sellers = [], returnTo }: {
  site: string; product?: P; categories: string[]; features?: Record<string, boolean>; uploadUrl: string; storeId: string; returnTo?: "wizard";
  catalog?: CatalogItem[]; sellers?: { id: string; name: string }[];
}) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(saveProduct.bind(null, site, product?.id ?? null), undefined);
  const f = features;
  // datetime-local is in the browser's zone; convert Pakistan-time text back to UTC on submit.
  const pk = (v: string) => (v ? new Date(`${v}:00+05:00`).toISOString() : "");
  const submit = (fd: FormData) => {
    for (const k of ["publishAt", "saleEndsAt"]) fd.set(k, pk(String(fd.get(k) ?? "")));
    a(fd);
  };
  const variantText = (product?.variants ?? []).map((v) => [v.name, v.price ?? "", v.stock, v.sku, v.barcode].join(" | ")).join("\n");
  const [kind, setKind] = useState(product?.kind ?? "physical");
  const customText = (product?.customFields ?? []).map((c) => [c.label, c.required ? "required" : "optional", c.maxLength].join(" | ")).join("\n");
  return (
    <KeepForm action={submit} className="space-y-4">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <Field label={T("Product name")}><input name="name" required defaultValue={product?.name} className={tealInput} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={T("Price")}><input name="price" type="number" min="0" required defaultValue={product?.price} className={tealInput} /></Field>
        <Field label={T("Compare-at price")} hint={T("Shows a sale badge when higher.")}><input name="compareAtPrice" type="number" min="0" defaultValue={product?.compareAtPrice ?? ""} className={tealInput} /></Field>
        <Field label={T("Stock")} hint={f["F-02"] ? "Ignored when the product has variants." : undefined}><input name="stock" type="number" min="0" step="1" defaultValue={product?.stock ?? 0} className={tealInput} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={T("Category")}>
          <input name="category" list="cats" defaultValue={product?.category} className={tealInput} placeholder={T("e.g. Phones")} />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label={T("Brand")}><input name="brand" defaultValue={product?.brand} className={tealInput} /></Field>
        <Field label={T("SKU")}><input name="sku" defaultValue={product?.sku} className={tealInput} /></Field>
        <Field label={T("Barcode")} hint={T("Used by the POS scanner.")}><input name="barcode" defaultValue={product?.barcode} className={tealInput} /></Field>
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium text-slate-800">{T("Photos")}</span>
        <ImageField name="images" initial={product?.images ?? []} uploadUrl={uploadUrl} folder={`stores/${storeId}/products`} />
      </div>
      <Field label={T("Description")}><textarea name="description" rows={5} defaultValue={product?.description} className={tealInput} /></Field>

      {(f["F-12"] || f["F-32"]) && (
        <Field label={T("What kind of product is this?")}>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={tealInput}>
            <option value="physical">{T("📦 Physical item — delivered or picked up")}</option>
            {f["F-12"] && <option value="digital">{T("💾 Digital download — a file the customer downloads")}</option>}
            {f["F-32"] && <option value="giftcard">🎁 Gift card — the price is the card&apos;s value</option>}
          </select>
        </Field>
      )}
      {f["F-12"] && kind === "digital" && (
        <div className="space-y-1 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <span className="text-sm font-semibold text-sky-900">{T("💾 Download file")}</span>
          <FileField name="digital" initial={product?.digitalFile} uploadUrl={uploadUrl} folder={`stores/${storeId}/downloads`} />
        </div>
      )}
      {f["F-32"] && kind === "giftcard" && (
        <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900">🎁 Shoppers can add the recipient&apos;s email and a message. When you confirm the order, a gift card code worth the price is created and emailed to the recipient. It&apos;s also shown on the order page.</p>
      )}
      {f["F-13"] && kind === "physical" && (
        <Section title={T("🧺 Bundle (sell several products as one)")} open={!!product?.bundle?.length}>
          <BundleEditor initial={product?.bundle ?? []} catalog={catalog.filter((c) => c.id !== product?.id)} />
        </Section>
      )}
      {f["F-63"] && (
        <Section title={T("✍️ Personalisation fields")} open={!!product?.customFields?.length}>
          <Field label={T("Fields the shopper fills in")} hint='One per line: label | required or optional | max letters. E.g. "Name to engrave | required | 20"'>
            <textarea name="customFields" rows={3} defaultValue={customText} className={`${tealInput} font-mono text-xs`} placeholder={"Name to engrave | required | 20\nGift note | optional | 120"} />
          </Field>
        </Section>
      )}
      {f["F-57"] && (
        <Section title={T("🛒 Suggest with this product")} open={!!product?.upsells?.length}>
          <UpsellPicker initial={product?.upsells ?? []} catalog={catalog} self={product?.id} />
        </Section>
      )}
      {f["F-67"] && sellers.length > 0 && (
        <Field label={T("Seller")} hint={T("Marketplace seller who supplies this product. Leave empty if your store sells it.")}>
          <select name="seller" defaultValue={product?.seller ?? ""} className={tealInput}>
            <option value="">{T("Your store")}</option>
            {sellers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
      )}

      {f["F-02"] && (
        <Section title={T("🎨 Variants (sizes, colors)")} open={!!product?.variants?.length}>
          <Field label={T("Option names")} hint='Separate with "/", e.g. Color / Size.'><input name="optionNames" defaultValue={product?.optionNames?.join(" / ")} className={tealInput} placeholder={T("Color / Size")} /></Field>
          <Field label={T("Variants")} hint={T("One per line: name | price (blank = product price) | stock | SKU | barcode")}>
            <textarea name="variants" rows={5} defaultValue={variantText} className={`${tealInput} font-mono text-xs`} placeholder={"Red / M | | 10 | TS-RED-M | 1001\nRed / L | 1600 | 4 | TS-RED-L | 1002"} />
          </Field>
        </Section>
      )}
      {(f["F-62"] || f["F-66"] || f["F-61"] || f["F-82"]) && (
        <Section title={T("💰 Pricing rules")} open={!!(product?.salePrice || product?.volumeTiers?.length)}>
          {f["F-66"] && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={T("Flash sale price")}><input name="salePrice" type="number" min="0" defaultValue={product?.salePrice ?? ""} className={tealInput} /></Field>
              <Field label={T("Sale ends (Pakistan time)")} hint={T("A countdown shows on the product page.")}><input name="saleEndsAt" type="datetime-local" defaultValue={toLocalInput(product?.saleEndsAt)} className={tealInput} /></Field>
            </div>
          )}
          {f["F-62"] && (
            <Field label={T("Volume prices")} hint='One per line: "10 = 900" means 900 each when buying 10 or more.'>
              <textarea name="volumeTiers" rows={2} defaultValue={(product?.volumeTiers ?? []).map((t) => `${t.minQty} = ${t.price}`).join("\n")} className={`${tealInput} font-mono text-xs`} />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {f["F-61"] && <Field label={T("Wholesale price")} hint={T("For customers marked as wholesale.")}><input name="wholesalePrice" type="number" min="0" defaultValue={product?.wholesalePrice ?? ""} className={tealInput} /></Field>}
            {f["F-82"] && <Field label={T("Cost price")} hint={T("Used for profit reports. Customers never see it.")}><input name="costPrice" type="number" min="0" defaultValue={product?.costPrice ?? 0} className={tealInput} /></Field>}
          </div>
        </Section>
      )}
      {(f["F-93"] || f["F-92"] || f["F-111"] || f["F-64"]) && (
        <Section title={T("🧾 More details")} open={!!(product?.tags?.length || product?.sizeGuide)}>
          {f["F-93"] && <Field label={T("Tags")} hint={T("Comma separated, e.g. summer, cotton, new")}><input name="tags" defaultValue={product?.tags?.join(", ")} className={tealInput} /></Field>}
          <div className="grid gap-3 sm:grid-cols-2">
            {f["F-92"] && <Field label={T("Publish at (Pakistan time)")} hint={T("Hidden from the store until then. Leave empty to publish now.")}><input name="publishAt" type="datetime-local" defaultValue={toLocalInput(product?.publishAt)} className={tealInput} /></Field>}
            {f["F-111"] && <Field label={T("Warranty (months)")} hint={T("0 = no warranty")}><input name="warrantyMonths" type="number" min="0" max="240" defaultValue={product?.warrantyMonths ?? 0} className={tealInput} /></Field>}
          </div>
          {f["F-64"] && <Field label={T("Size guide")} hint={T("Plain text. Use one line per size, e.g. S: chest 36in.")}><textarea name="sizeGuide" rows={4} defaultValue={product?.sizeGuide} className={tealInput} /></Field>}
        </Section>
      )}
      <Field label={T("Visibility")}>
        <select name="status" defaultValue={product?.status ?? "active"} className={tealInput}>
          <option value="active">{T("Active — shown in the store")}</option>
          <option value="draft">{T("Draft — hidden")}</option>
        </select>
      </Field>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? "Saving…" : product?.id ? T("Save changes") : T("Add product")}</button>
    </KeepForm>
  );
}

export function RefundForm({ site, number, max }: { site: string; number: number; max: number }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(refundOrder.bind(null, site, number), undefined);
  return (
    <KeepForm action={a} className="space-y-3">
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <input name="amount" type="number" min="1" max={max} defaultValue={max} className={tealInput} aria-label={T("Refund amount")} />
        <input name="reason" placeholder={T("Reason")} className={tealInput} aria-label={T("Refund reason")} />
      </div>
      <FormMessage state={s} />
      <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500" disabled={p}>{p ? T("Refunding…") : T("Refund")}</button>
    </KeepForm>
  );
}

export function DiscountForm({ site }: { site: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(saveDiscount.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="grid gap-3 sm:grid-cols-3">
      <Field label={T("Code")}><input name="code" required className={`${tealInput} uppercase`} placeholder={T("EID20")} /></Field>
      <Field label={T("Type")}>
        <select name="type" className={tealInput}><option value="percent">{T("% off")}</option><option value="fixed">{T("Amount off")}</option></select>
      </Field>
      <Field label={T("Value")}><input name="value" type="number" min="1" required className={tealInput} /></Field>
      <Field label={T("Minimum order")}><input name="minSubtotal" type="number" min="0" defaultValue={0} className={tealInput} /></Field>
      <Field label={T("Usage limit")} hint={T("0 = unlimited")}><input name="usageLimit" type="number" min="0" defaultValue={0} className={tealInput} /></Field>
      <Field label={T("Expires (optional)")}><input name="expiresAt" type="date" className={tealInput} /></Field>
      <div className="sm:col-span-3 space-y-2">
        <FormMessage state={s} />
        <button className={btnTealCls} disabled={p}>{p ? T("Creating…") : T("Create code")}</button>
      </div>
    </KeepForm>
  );
}

export function StaffForm({ site, canAddManager }: { site: string; canAddManager: boolean }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(addStaff.bind(null, site), undefined);
  const [role, setRole] = useState(canAddManager ? "manager" : "cashier");
  return (
    <KeepForm action={a} className="grid gap-3 sm:grid-cols-2">
      <Field label={T("Name")}><input name="name" required className={tealInput} /></Field>
      <Field label={T("Email")}><input name="email" type="email" required className={tealInput} /></Field>
      <Field label={T("Temporary password")}><input name="password" type="text" minLength={8} required className={tealInput} /></Field>
      <Field label={T("Role")}>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={tealInput}>
          {canAddManager && <option value="manager">{T("Manager — catalog, orders, discounts, POS")}</option>}
          <option value="cashier">{T("Cashier — POS only")}</option>
        </select>
      </Field>
      <Field label={T("Refund limit at POS")} hint={T("Larger refunds need a manager PIN.")}><input name="refundLimit" type="number" min="0" defaultValue={role === "manager" ? 100000 : 500} className={tealInput} /></Field>
      {role === "manager" && <Field label={T("Manager PIN")} hint={T("4–6 digits, approves large refunds.")}><input name="pin" inputMode="numeric" pattern="\d{4,6}" className={tealInput} /></Field>}
      <div className="sm:col-span-2 space-y-2">
        <FormMessage state={s} />
        <button className={btnTealCls} disabled={p}>{p ? T("Adding…") : T("Add staff member")}</button>
      </div>
    </KeepForm>
  );
}

export function BrandingForm({ site, name, color, tagline, logoUrl, canColor, uploadUrl, storeId, next }: { site: string; name: string; color: string; tagline: string; logoUrl?: string | null; canColor: boolean; uploadUrl: string; storeId: string; next?: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(saveBranding.bind(null, site), undefined);
  useGoNext(s, next);
  const [c, setC] = useState(color);
  const [n, setN] = useState(name);
  const swatches = ["#4f46e5", "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#d97706", "#16a34a", "#0d9488", "#0284c7", "#0f172a"];
  return (
    <KeepForm action={a} className="grid gap-5 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <Field label={T("Store name")}><input name="name" value={n} onChange={(e) => setN(e.target.value)} required className={tealInput} /></Field>
        <Field label={T("Tagline")} hint={T("One line under the store name.")}><input name="tagline" defaultValue={tagline} className={tealInput} placeholder={T("Quality gadgets, delivered fast")} /></Field>
        <div className="space-y-1">
          <span className="text-sm font-medium text-slate-800">{T("Logo (optional)")}</span>
          <ImageField name="logoUrl" single initial={logoUrl ? [logoUrl] : []} uploadUrl={uploadUrl} folder={`stores/${storeId}/branding`} />
        </div>
        <div>
          <span className="text-sm font-medium text-slate-800">{T("Brand color")}</span>
          {!canColor && <p className="text-xs text-amber-700">{T("Turn on F-15 (theme switching) to change it.")}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {swatches.map((sw) => (
              <button type="button" key={sw} disabled={!canColor} onClick={() => setC(sw)} aria-label={`Use ${sw}`}
                className={`h-8 w-8 rounded-full ring-offset-2 transition ${c === sw ? "ring-2 ring-slate-900" : ""}`} style={{ background: sw }} />
            ))}
            <input type="color" name="primaryColor" value={c} disabled={!canColor} onChange={(e) => setC(e.target.value)} className="h-8 w-12 cursor-pointer rounded" aria-label={T("Custom color")} />
            {!canColor && <input type="hidden" name="primaryColor" value={c} />}
          </div>
        </div>
        <FormMessage state={s} />
        <button className={btnTealCls} disabled={p}>{p ? T("Saving…") : T("Save branding")}</button>
      </div>
      <div aria-hidden className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-4 py-6 text-white" style={{ background: `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 55%, #ec4899))` }}>
          <p className="text-[10px] uppercase tracking-widest opacity-80">{T("Preview")}</p>
          <p className="text-lg font-bold">{n || "Your store"}</p>
        </div>
        <div className="space-y-2 bg-white p-4">
          <div className="h-16 rounded-lg" style={{ background: `color-mix(in srgb, ${c} 12%, white)` }} />
          <div className="h-2 w-2/3 rounded bg-slate-200" />
          <div className="rounded-lg py-1.5 text-center text-xs font-semibold text-white" style={{ background: c }}>{T("Add to cart")}</div>
        </div>
      </div>
    </KeepForm>
  );
}

type S = {
  currency: string; shippingFlat: number; freeShippingThreshold: number; taxRate: number; whatsapp: string; announcement: string;
  pickupAddress: string; contactEmail: string; seoTitle: string; seoDescription: string; lowStockAt: number;
  giftWrapFee: number; deliverySlots: string[]; ntn: string; gstNumber: string; pointsPer: number; pointValue: number;
  referralReward: number; refundApprovalAbove: number;
};

export function SettingsForm({ site, s: v, f, next }: { site: string; s: S; f: Record<string, boolean>; next?: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(saveSettings.bind(null, site), undefined);
  useGoNext(s, next);
  const off = (id: string) => (f[id] ? undefined : <span className="text-amber-700">Turn on {id} to use this.</span>);
  return (
    <KeepForm action={a} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={T("Currency")}>
          <select name="currency" defaultValue={v.currency} className={tealInput}>{["PKR", "USD", "AED", "GBP", "EUR", "SAR"].map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label={T("Delivery fee")} hint={off("F-29") ?? "Flat fee per order."}><input name="shippingFlat" type="number" min="0" defaultValue={v.shippingFlat} className={tealInput} /></Field>
        <Field label={T("Free delivery over")} hint={off("F-58") ?? "0 turns it off."}><input name="freeShippingThreshold" type="number" min="0" defaultValue={v.freeShippingThreshold} className={tealInput} /></Field>
        <Field label={T("Tax rate (%)")} hint={off("F-31") ?? "Added at checkout."}><input name="taxRate" type="number" min="0" max="100" step="0.1" defaultValue={v.taxRate} className={tealInput} /></Field>
        <Field label={T("Low stock warning at")} hint={off("F-18") ?? "Shown on your dashboard."}><input name="lowStockAt" type="number" min="0" defaultValue={v.lowStockAt} className={tealInput} /></Field>
        <Field label={T("Contact email")}><input name="contactEmail" type="email" defaultValue={v.contactEmail} className={tealInput} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={T("WhatsApp number")} hint={off("F-54") ?? "With country code, e.g. 923001234567."}><input name="whatsapp" defaultValue={v.whatsapp} className={tealInput} /></Field>
        <Field label={T("Pickup address")} hint={off("F-59")}><input name="pickupAddress" defaultValue={v.pickupAddress} className={tealInput} /></Field>
      </div>
      <Field label={T("Announcement bar")} hint={off("F-118") ?? "Shown across the top of every page. Leave empty to hide."}><input name="announcement" defaultValue={v.announcement} className={tealInput} placeholder={T("🎉 Eid sale: 20% off with code EID20")} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={T("SEO title")} hint={off("F-75")}><input name="seoTitle" defaultValue={v.seoTitle} maxLength={70} className={tealInput} /></Field>
        <Field label={T("SEO description")} hint={off("F-75")}><input name="seoDescription" defaultValue={v.seoDescription} maxLength={160} className={tealInput} /></Field>
      </div>
      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">{T("More checkout and order options")}</summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={T("Delivery time slots")} hint={off("F-60") ?? "One per line. Shoppers pick one at checkout."}><textarea name="deliverySlots" rows={3} defaultValue={v.deliverySlots.join("\n")} className={tealInput} /></Field>
            <Field label={T("Gift wrap fee")} hint={off("F-74")}><input name="giftWrapFee" type="number" min="0" defaultValue={v.giftWrapFee} className={tealInput} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={T("NTN")} hint={off("F-104") ?? "Printed on tax invoices."}><input name="ntn" defaultValue={v.ntn} className={tealInput} /></Field>
            <Field label={T("GST / STRN number")} hint={off("F-104")}><input name="gstNumber" defaultValue={v.gstNumber} className={tealInput} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={T("Spend per loyalty point")} hint={off("F-28") ?? "e.g. 100 = 1 point per Rs 100."}><input name="pointsPer" type="number" min="1" defaultValue={v.pointsPer} className={tealInput} /></Field>
            <Field label={T("Value of 1 point")} hint={off("F-28")}><input name="pointValue" type="number" min="0" step="0.01" defaultValue={v.pointValue} className={tealInput} /></Field>
            <Field label={T("Referral reward (credit)")} hint={off("F-70") ?? "Both people get this."}><input name="referralReward" type="number" min="0" defaultValue={v.referralReward} className={tealInput} /></Field>
          </div>
          <Field label={T("Refunds above this need a second approver")} hint={off("F-105")}><input name="refundApprovalAbove" type="number" min="0" defaultValue={v.refundApprovalAbove} className={tealInput} /></Field>
        </div>
      </details>
      <FormMessage state={s} />
      <button className={btnTealCls} disabled={p}>{p ? T("Saving…") : T("Save settings")}</button>
    </KeepForm>
  );
}

export function DomainForm({ site, current }: { site: string; current?: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(setCustomDomain.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-3">
      <div className="flex gap-2">
        <input name="domain" defaultValue={current} placeholder={T("shop.example.com")} className={tealInput} aria-label={T("Custom domain")} />
        <button className={btnTealCls} disabled={p}>{p ? "Adding…" : current ? T("Change") : T("Add domain")}</button>
      </div>
      <FormMessage state={s} />
    </KeepForm>
  );
}

export function SubdomainForm({ site, current, root, nextChange }: { site: string; current: string; root: string; nextChange?: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(changeSubdomain.bind(null, site), undefined);
  return (
    <KeepForm action={a} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input name="subdomain" defaultValue={current} pattern="[a-z0-9-]{3,63}" className={`${tealInput} !w-56`} aria-label={T("New subdomain")} />
        <span className="text-slate-500">.{root}</span>
        <button className={btnTealCls} disabled={p || !!nextChange}>{T("Change address")}</button>
      </div>
      <p className="text-xs text-slate-500">{nextChange ? `You can change it again on ${nextChange}.` : "You can change the address once every 30 days. Old links stop working."}</p>
      <FormMessage state={s} />
    </KeepForm>
  );
}

/** In the setup wizard: after a successful save, go on to the next step (it shows a "saved" note). */
function useGoNext(s: MState, next?: string) {
  const router = useRouter();
  useEffect(() => { if (next && s?.ok) router.push(next); }, [s, next, router]);
}

/** Turns on the starter pack and shows what happened. */
export function StarterPackButton({ site, label }: { site: string; label: string }) {
  const T = usePT();
  const [s, a, p] = useActionState<MState, FormData>(() => ownerStarterPack(site), undefined);
  return (
    <form action={a} className="flex flex-wrap items-center gap-3">
      <button className={btnTealCls} disabled={p}>{p ? T("Turning on…") : label}</button>
      {s?.ok && <span role="status" className="text-sm text-emerald-700">✅ {T(s.ok)}</span>}
      {s?.error && <span role="alert" className="text-sm text-rose-700">{T(s.error)}</span>}
    </form>
  );
}
