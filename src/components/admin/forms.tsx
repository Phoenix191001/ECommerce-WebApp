"use client";

import { KeepForm } from "@/components/keep-form";
import { useActionState, useState } from "react";
import {
  addProduct, createInstance, createOwnerLink, deleteInstance, login, savePlan, setupAdmin, verifyTwoFactor,
  type FormState,
} from "@/app/admin/actions";
import { Field, FormMessage, btnCls, btnDangerCls, btnSecondaryCls, inputCls } from "./ui";

export function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "setup" ? setupAdmin : login, undefined);
  return (
    <KeepForm action={action} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={inputCls} />
      </Field>
      <Field label="Password" hint={mode === "setup" ? "At least 10 characters." : undefined}>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "setup" ? 10 : undefined}
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
          className={inputCls}
        />
      </Field>
      <FormMessage state={state} />
      <button className={`${btnCls} w-full`} disabled={pending}>
        {pending ? "Please wait…" : mode === "setup" ? "Create Super Admin" : "Continue"}
      </button>
    </KeepForm>
  );
}

export function TwoFactorForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(verifyTwoFactor, undefined);
  return (
    <KeepForm action={action} className="space-y-4">
      <Field label="6-digit code">
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
          className={`${inputCls} text-center font-mono text-xl tracking-[0.4em]`}
        />
      </Field>
      <FormMessage state={state} />
      <button className={`${btnCls} w-full`} disabled={pending}>{pending ? "Checking…" : "Verify and sign in"}</button>
    </KeepForm>
  );
}

export function InstanceForm({ plans, rootDomain }: { plans: { id: string; name: string; description: string }[]; rootDomain: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInstance, undefined);
  const [sub, setSub] = useState("");
  return (
    <KeepForm action={action} className="space-y-5">
      <Field label="Store name">
        <input name="name" required className={inputCls} placeholder="Ali's Electronics" />
      </Field>
      <Field
        label="Subdomain"
        hint={<>The store will be at <b className="text-indigo-700">{sub || "subdomain"}.{rootDomain}</b>. Lowercase letters, numbers and hyphens.</>}
      >
        <input
          name="subdomain"
          required
          pattern="[a-z0-9-]{3,63}"
          className={inputCls}
          placeholder="ali-electronics"
          value={sub}
          onChange={(e) => setSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">Plan</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p, i) => (
            <label key={p.id} className="cursor-pointer rounded-xl border-2 border-slate-200 p-3 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
              <input type="radio" name="planId" value={p.id} defaultChecked={i === 0} className="sr-only" />
              <span className="block font-semibold text-slate-900">{p.name}</span>
              <span className="block text-xs text-slate-600">{p.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner name"><input name="ownerName" required className={inputCls} /></Field>
        <Field label="Owner email"><input name="ownerEmail" type="email" required className={inputCls} /></Field>
      </div>
      <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
        ✨ New stores start with the <b>starter pack</b> of features turned on (limited to the plan). You can change any of them afterwards.
      </p>
      <FormMessage state={state} />
      <button className={btnCls} disabled={pending}>{pending ? "Creating…" : "Create instance"}</button>
    </KeepForm>
  );
}

export function ProductForm({ instanceId }: { instanceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addProduct.bind(null, instanceId), undefined);
  return (
    <KeepForm action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <Field label="Name"><input name="name" required className={inputCls} /></Field>
      <Field label="Price"><input name="price" type="number" min="0" step="1" required className={inputCls} /></Field>
      <Field label="Stock"><input name="stock" type="number" min="0" step="1" defaultValue="0" className={inputCls} /></Field>
      <button className={btnCls} disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      <div className="sm:col-span-4"><FormMessage state={state} /></div>
    </KeepForm>
  );
}

export function OwnerLinkForm({ instanceId }: { instanceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createOwnerLink.bind(null, instanceId), undefined);
  const [copied, setCopied] = useState(false);
  const full = state?.link && typeof window !== "undefined" ? `${window.location.origin}${state.link}` : "";
  return (
    <KeepForm action={action} className="space-y-3">
      <button className={btnSecondaryCls} disabled={pending}>🔑 {pending ? "Creating…" : "Create owner setup link"}</button>
      <FormMessage state={state} />
      {full && (
        <div className="flex gap-2">
          <input readOnly value={full} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className={btnSecondaryCls}
            onClick={() => navigator.clipboard.writeText(full).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </KeepForm>
  );
}

export function DeleteForm({ instanceId, subdomain }: { instanceId: string; subdomain: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteInstance.bind(null, instanceId), undefined);
  return (
    <KeepForm action={action} className="space-y-3">
      <Field label={`Type "${subdomain}" to confirm`}>
        <input name="confirm" autoComplete="off" className={inputCls} />
      </Field>
      <FormMessage state={state} />
      <button className={btnDangerCls} disabled={pending}>{pending ? "Deleting…" : "Delete store permanently"}</button>
    </KeepForm>
  );
}

type PlanGroup = { label: string; features: { id: string; name: string }[] };

export function PlanForm({
  plan,
  groups,
}: {
  plan?: { id: string; name: string; description: string; priceMonthly: number; features: string[]; maxProducts: number; maxStaff: number; maxDomains: number; requiresActivation?: boolean };
  groups: PlanGroup[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePlan.bind(null, plan?.id ?? null), undefined);
  const [sel, setSel] = useState<Set<string>>(new Set(plan?.features ?? []));
  const flip = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setGroup = (ids: string[], on: boolean) => setSel((s) => { const n = new Set(s); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; });
  return (
    <KeepForm action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input name="name" required defaultValue={plan?.name} className={inputCls} /></Field>
        <Field label="Price per month (PKR)"><input name="priceMonthly" type="number" min="0" defaultValue={plan?.priceMonthly ?? 0} className={inputCls} /></Field>
      </div>
      <Field label="Description"><input name="description" defaultValue={plan?.description} className={inputCls} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Max products" hint="0 = unlimited"><input name="maxProducts" type="number" min="0" defaultValue={plan?.maxProducts ?? 0} className={inputCls} /></Field>
        <Field label="Max staff" hint="0 = unlimited"><input name="maxStaff" type="number" min="0" defaultValue={plan?.maxStaff ?? 0} className={inputCls} /></Field>
        <Field label="Custom domains"><input name="maxDomains" type="number" min="0" defaultValue={plan?.maxDomains ?? 0} className={inputCls} /></Field>
      </div>
      <label className="flex items-start gap-2 rounded-lg bg-violet-50 p-3 text-sm">
        <input type="checkbox" name="requiresActivation" value="1" defaultChecked={!!plan?.requiresActivation} className="mt-0.5 accent-violet-600" />
        <span>
          <b>Contact to activate</b>
          <span className="block text-xs text-slate-600">Shoppers can&apos;t pick this plan on the signup page; they see a button to email you instead. You assign it to their store from the store&apos;s page.</span>
        </span>
      </label>
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Included features ({sel.size})</summary>
        <div className="mt-3 space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {g.label}
                <button type="button" className="text-indigo-600 normal-case" onClick={() => setGroup(g.features.map((f) => f.id), true)}>all</button>
                <button type="button" className="text-slate-500 normal-case" onClick={() => setGroup(g.features.map((f) => f.id), false)}>none</button>
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {g.features.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="features" value={f.id} checked={sel.has(f.id)} onChange={() => flip(f.id)} className="accent-indigo-600" />
                    <span className="font-mono text-xs text-slate-500">{f.id}</span> {f.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
      <FormMessage state={state} />
      <button className={btnCls} disabled={pending}>{pending ? "Saving…" : plan ? "Save plan" : "Create plan"}</button>
    </KeepForm>
  );
}
