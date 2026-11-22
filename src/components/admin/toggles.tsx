"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FEATURE_MAP, dependentsOf, type Feature, type FeatureGroup } from "@/lib/features";
import { HOW_TO } from "@/lib/feature-help";
import { usePT } from "@/components/manage/panel-lang";

export type ToggleAction = (id: string, on: boolean, withPrereqs?: boolean) => Promise<{ error?: string; missing?: string[] }>;

type Props = {
  groups: { group: FeatureGroup; label: string; features: Feature[] }[];
  toggles: Record<string, boolean>;
  effective: Record<string, boolean>;
  locked: string[];
  planFeatures: string[];
  descriptions: Record<string, string>;
  implemented: string[];
  onToggle: ToggleAction;
  /** Super Admin only: lock / unlock toggles. */
  onLock?: (id: string, locked: boolean) => Promise<unknown>;
  guideHref?: string;
  /** Feature names and how-tos in the viewer's language (English when left out). */
  names?: Record<string, string>;
  howTo?: Record<string, string>;
};

const GROUP_COLORS = [
  "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-sky-500",
  "bg-violet-500", "bg-teal-500", "bg-orange-500", "bg-fuchsia-500", "bg-cyan-500",
  "bg-lime-500", "bg-pink-500", "bg-blue-500", "bg-yellow-500", "bg-red-500",
];

export function ToggleBoard(p: Props) {
  const T = usePT();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(p.toggles, (s, [id, on]: [string, boolean]) => ({ ...s, [id]: on }));
  const [message, setMessage] = useState<{ text: string; id?: string; missing?: string[] } | null>(null);
  const [filter, setFilter] = useState("");
  const [show, setShow] = useState<"all" | "on" | "available">("all");
  // Groups are dropdowns, closed at first. "Open all"/"Close all" bumps `round` so every group takes the new state.
  const [allOpen, setAllOpen] = useState<{ open: boolean; round: number }>({ open: false, round: 0 });
  const inPlan = new Set(p.planFeatures);
  const locked = new Set(p.locked);
  const impl = new Set(p.implemented);
  const guide = p.guideHref ?? "/guide";
  const nm = (id: string) => p.names?.[id] ?? FEATURE_MAP[id]?.name ?? id;

  const run = (id: string, on: boolean, withPrereqs = false) =>
    start(async () => {
      setMessage(null);
      setOptimistic([id, on]);
      const res = await p.onToggle(id, on, withPrereqs);
      if (res?.error) setMessage({ text: res.error, id, missing: res.missing });
    });

  const q = filter.trim().toLowerCase();
  const onCount = Object.values(p.effective).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={T("Search features by name, F-number, or description…")}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
          {(["all", "on", "available"] as const).map((k) => (
            <button key={k} onClick={() => setShow(k)} className={`rounded-md px-3 py-1.5 ${show === k ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}>
              {k === "all" ? T("All") : k === "on" ? `${T("On")} (${onCount})` : T("In plan")}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAllOpen((x) => ({ open: !x.open, round: x.round + 1 }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {allOpen.open ? T("▴ Close all") : T("▾ Open all")}
        </button>
        {pending && <span className="animate-pulse text-sm text-indigo-600">{T("Saving…")}</span>}
      </div>
      {message && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>⚠️ {T(message.text)}</span>
          {message.missing?.length && message.id ? (
            <button
              onClick={() => run(message.id!, true, true)}
              className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
            >
              {T(`Turn on ${message.id} with ${message.missing.join(", ")}`)}
            </button>
          ) : null}
        </div>
      )}
      {p.groups.map(({ group, label, features }, gi) => {
        const shown = features.filter((f) => {
          if (show === "on" && !optimistic[f.id]) return false;
          if (show === "available" && !inPlan.has(f.id)) return false;
          return !q || f.name.toLowerCase().includes(q) || nm(f.id).toLowerCase().includes(q) || f.id.toLowerCase() === q || f.id.toLowerCase().includes(q) || (p.descriptions[f.id] ?? "").toLowerCase().includes(q);
        });
        if (!shown.length) return null;
        const searching = !!q || show !== "all";
        const nOn = features.filter((f) => p.effective[f.id]).length;
        return (
          <details key={`${group}-${allOpen.round}-${searching}`} open={searching || allOpen.open} className="group/acc rounded-xl border border-slate-200 bg-white open:pb-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className={`h-2.5 w-2.5 rounded-full ${GROUP_COLORS[gi % GROUP_COLORS.length]}`} />
              {label}
              <span className="ms-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{T(`${nOn} of ${features.length} on`)}</span>
              <span aria-hidden className="text-slate-400 transition group-open/acc:rotate-180">▾</span>
            </summary>
            <ul className="mx-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {shown.map((f) => {
                const on = !!optimistic[f.id];
                const blocked = on && !p.effective[f.id];
                const allowed = inPlan.has(f.id);
                const isLocked = locked.has(f.id);
                const ownerLocked = isLocked && !p.onLock;
                return (
                  <li key={f.id} className={`flex items-start gap-3 px-4 py-3 ${on ? "bg-indigo-50/40" : ""}`}>
                    <button
                      role="switch"
                      aria-checked={on}
                      aria-label={`${f.id} ${nm(f.id)}`}
                      disabled={pending || ownerLocked || (!allowed && !on)}
                      onClick={() => run(f.id, !on)}
                      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                        <span className="rounded bg-slate-100 px-1.5 font-mono text-[11px] text-slate-600">{f.id}</span>
                        {nm(f.id)}
                        {!impl.has(f.id) && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">{T("Coming soon")}</span>}
                        {!allowed && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{T("Not in plan")}</span>}
                        {isLocked && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-white">{T("🔒 Locked")}</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">{p.descriptions[f.id]}</p>
                      <details className="group/f mt-1">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline [&::-webkit-details-marker]:hidden">
                          <span className="transition group-open/f:rotate-90" aria-hidden>▸</span> {T("What it does and how to use it")}
                        </summary>
                        <div className="mt-2 space-y-1.5 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs text-slate-700">
                          <p>{p.howTo?.[f.id] ?? HOW_TO[f.id]}</p>
                          {f.requires.length > 0 && <p><b>{T("Needs:")}</b> {f.requires.map((r) => `${r} ${nm(r)}`).join(" · ")}</p>}
                          {dependentsOf(f.id).length > 0 && <p><b>{T("Unlocks:")}</b> {dependentsOf(f.id).map((r) => `${r} ${nm(r)}`).join(" · ")}</p>}
                          <a href={`${guide}#${f.id}`} target="_blank" className="inline-block text-indigo-600 hover:underline">{T("Open in the feature guide ↗")}</a>
                        </div>
                      </details>
                      {blocked && <p className="mt-0.5 text-[11px] font-medium text-amber-700">{T("· Inactive until its prerequisites are on")}</p>}
                      {blocked && (
                        <button onClick={() => run(f.id, true, true)} className="mt-1 text-xs font-semibold text-amber-700 underline">
                          {T("Turn on missing prerequisites")}
                        </button>
                      )}
                    </div>
                    {p.onLock && (
                      <button
                        onClick={() => start(async () => { await p.onLock!(f.id, !isLocked); })}
                        disabled={pending}
                        title={isLocked ? T("Unlock so the Store Owner can change it") : T("Lock so the Store Owner can't change it")}
                        className={`shrink-0 rounded-md px-2 py-1 text-xs ${isLocked ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                      >
                        {isLocked ? T("Unlock") : T("Lock")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
