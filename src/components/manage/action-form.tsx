"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { FormMessage, btnTealCls } from "@/components/admin/ui";
import { usePT } from "@/components/manage/panel-lang";

type State = { error?: string; ok?: string; link?: string } | undefined;

/**
 * A form for a server action that is already bound to its arguments (site, id…).
 * Fields are passed as children from the server page. Keeps what was typed on error;
 * clears it after a successful save when `reset` is set.
 */
export function ActionForm({
  action, children, submit, pending = "Saving…", reset, className = "space-y-3", danger,
}: {
  action: (s: State, fd: FormData) => Promise<State>;
  children: React.ReactNode;
  submit: string;
  pending?: string;
  reset?: boolean;
  className?: string;
  danger?: boolean;
}) {
  const T = usePT();
  const [s, a, p] = useActionState<State, FormData>(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (reset && s?.ok) ref.current?.reset();
  }, [s, reset]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => a(fd));
      }}
    >
      {children}
      <FormMessage state={s} />
      {s?.link && (
        <input readOnly value={s.link.startsWith("/") && typeof window !== "undefined" ? `${window.location.origin}${s.link}` : s.link} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs" aria-label={T("Link")} />
      )}
      <button className={danger ? "rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50" : btnTealCls} disabled={p}>{p ? pending : submit}</button>
    </form>
  );
}
