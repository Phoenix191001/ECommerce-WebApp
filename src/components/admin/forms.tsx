"use client";

import { useActionState } from "react";
import { addProduct, createInstance, login, setupAdmin, type FormState } from "@/app/admin/actions";
import { Field, FormMessage, btnCls, inputCls } from "./ui";

export function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "setup" ? setupAdmin : login, undefined);
  return (
    <form action={action} className="space-y-4">
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
        {pending ? "Please wait…" : mode === "setup" ? "Create Super Admin" : "Sign in"}
      </button>
    </form>
  );
}

export function InstanceForm({ plans, rootDomain }: { plans: { id: string; name: string }[]; rootDomain: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInstance, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Store name">
        <input name="name" required className={inputCls} placeholder="Ali's Electronics" />
      </Field>
      <Field label="Subdomain" hint={`The store will be at <subdomain>.${rootDomain}`}>
        <input name="subdomain" required pattern="[a-z0-9-]{3,63}" className={inputCls} placeholder="ali-electronics" />
      </Field>
      <Field label="Plan">
        <select name="planId" required className={inputCls} defaultValue={plans[0]?.id}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner name">
          <input name="ownerName" required className={inputCls} />
        </Field>
        <Field label="Owner email">
          <input name="ownerEmail" type="email" required className={inputCls} />
        </Field>
      </div>
      <FormMessage state={state} />
      <button className={btnCls} disabled={pending}>{pending ? "Creating…" : "Create instance"}</button>
    </form>
  );
}

export function ProductForm({ instanceId }: { instanceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addProduct.bind(null, instanceId), undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <Field label="Name"><input name="name" required className={inputCls} /></Field>
      <Field label="Price"><input name="price" type="number" min="0" step="1" required className={inputCls} /></Field>
      <Field label="Stock"><input name="stock" type="number" min="0" step="1" defaultValue="0" className={inputCls} /></Field>
      <button className={btnCls} disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      <div className="sm:col-span-4"><FormMessage state={state} /></div>
    </form>
  );
}
