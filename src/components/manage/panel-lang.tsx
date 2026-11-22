"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPanelLanguage } from "@/app/s/[site]/manage/manage-actions";
import { LANGS } from "@/lib/languages";
import { translate } from "@/lib/tr-match";
import { FormMessage as BaseFormMessage } from "@/components/admin/ui";

// Store panel translations for interactive (client) components. Text is looked up by its
// English wording; anything not translated yet stays in English.
const Ctx = createContext<Record<string, string>>({});

export function PanelLangProvider({ dict, children }: { dict: Record<string, string>; children: React.ReactNode }) {
  return <Ctx.Provider value={dict}>{children}</Ctx.Provider>;
}

export function usePT() {
  const d = useContext(Ctx);
  return (s: string) => translate(d, s);
}

/** Language menu in the panel header (each staff member picks their own). */
export function PanelLangPicker({ site, lang }: { site: string; lang: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-50">
      <span aria-hidden>🌐</span>
      <select
        value={lang}
        disabled={pending}
        aria-label="Panel language"
        onChange={(e) => { const v = e.target.value; start(async () => { await setPanelLanguage(site, v); router.refresh(); }); }}
        className="cursor-pointer bg-transparent focus:outline-none"
      >
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
      </select>
    </label>
  );
}

/** Success or error message from a server action, in the panel's language. */
export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  const T = usePT();
  return <BaseFormMessage state={state && { error: state.error && T(state.error), ok: state.ok && T(state.ok) }} />;
}
