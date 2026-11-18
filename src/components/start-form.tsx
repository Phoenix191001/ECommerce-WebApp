"use client";

import { KeepForm } from "@/components/keep-form";
import { useActionState, useState } from "react";
import { startStore, type StartState } from "@/app/start/actions";
import { Field, FormMessage, btnCls, inputCls } from "@/components/admin/ui";

type StartPlan = { id: string; name: string; description: string; price: number; features: number; contactOnly: boolean };

export function StartForm({ plans, addressExample, salesEmail }: { plans: StartPlan[]; addressExample: string; salesEmail: string }) {
  const [s, a, p] = useActionState<StartState, FormData>(startStore, undefined);
  const [sub, setSub] = useState("");
  const firstOpen = plans.find((pl) => !pl.contactOnly)?.id;
  const mailto = (plan: string) =>
    `mailto:${salesEmail}?subject=${encodeURIComponent(`Activate the ${plan} plan`)}&body=${encodeURIComponent(
      `Hi,\n\nI'd like to activate the ${plan} plan.\n\nStore name:\nPreferred store address:\nMy name:\nPhone:\n`,
    )}`;
  return (
    <KeepForm action={a} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">1. Pick a plan</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((pl) =>
            pl.contactOnly ? (
              <div key={pl.id} className="rounded-2xl border-2 border-dashed border-violet-300 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
                <span className="flex items-baseline justify-between"><b className="text-lg">{pl.name}</b><span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">Contact to activate</span></span>
                <span className="mt-1 block text-xs text-slate-600">{pl.description}</span>
                <span className="mt-2 block text-xs font-medium text-slate-500">{pl.features} features</span>
                {salesEmail ? (
                  <a href={mailto(pl.name)} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500">
                    ✉️ Contact us to activate
                  </a>
                ) : (
                  <span className="mt-3 block text-xs text-slate-500">Contact the platform team to activate.</span>
                )}
                {salesEmail && <span className="mt-1 block break-all text-[11px] text-slate-500">{salesEmail}</span>}
              </div>
            ) : (
              <label key={pl.id} className="cursor-pointer rounded-2xl border-2 border-slate-200 p-4 transition has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50">
                <input type="radio" name="planId" value={pl.id} defaultChecked={pl.id === firstOpen} className="sr-only" />
                <span className="flex items-baseline justify-between"><b className="text-lg">{pl.name}</b><span className="text-sm font-semibold text-violet-700">{pl.price ? `Rs ${pl.price}/mo` : "Free"}</span></span>
                <span className="mt-1 block text-xs text-slate-600">{pl.description}</span>
                <span className="mt-2 block text-xs font-medium text-slate-500">{pl.features} features</span>
              </label>
            ),
          )}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold text-slate-800">2. Name your store</legend>
        <Field label="Store name"><input name="name" required className={inputCls} placeholder="Ayesha's Boutique" /></Field>
        <Field label="Store address" hint={<>Your store will be at <b className="text-violet-700">{addressExample.replace("SUB", sub || "your-store")}</b></>}>
          <input name="subdomain" required value={sub} onChange={(e) => setSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className={inputCls} placeholder="ayesha-boutique" />
        </Field>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold text-slate-800">3. Your owner account</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name"><input name="ownerName" required autoComplete="name" className={inputCls} /></Field>
          <Field label="Email"><input name="ownerEmail" type="email" required autoComplete="email" className={inputCls} /></Field>
        </div>
        <Field label="Password" hint="At least 10 characters."><input name="password" type="password" minLength={10} required autoComplete="new-password" className={inputCls} /></Field>
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </fieldset>
      <FormMessage state={s} />
      <button className={`${btnCls} w-full !py-3 text-base`} disabled={p}>{p ? "Creating your store…" : "🚀 Create my store"}</button>
      <p className="text-center text-xs text-slate-500">Your store is ready in seconds, with a setup wizard to add your first product.</p>
    </KeepForm>
  );
}
