"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setToggle, setToggleLock } from "@/app/admin/actions";
import type { Feature, FeatureGroup } from "@/lib/features";

type Props = {
  instanceId: string;
  groups: { group: FeatureGroup; label: string; features: Feature[] }[];
  toggles: Record<string, boolean>;
  effective: Record<string, boolean>;
  locked: string[];
  planFeatures: string[];
};

export function ToggleBoard({ instanceId, groups, toggles, effective, locked, planFeatures }: Props) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(toggles, (s, [id, on]: [string, boolean]) => ({ ...s, [id]: on }));
  const [message, setMessage] = useState<{ text: string; missing?: string[] } | null>(null);
  const [filter, setFilter] = useState("");
  const inPlan = new Set(planFeatures);
  const lockedSet = new Set(locked);

  const flip = (id: string, on: boolean) =>
    start(async () => {
      setMessage(null);
      setOptimistic([id, on]);
      const res = await setToggle(instanceId, id, on);
      if (res.error) setMessage({ text: res.error, missing: res.missing });
    });

  const turnOnAll = (ids: string[]) =>
    start(async () => {
      setMessage(null);
      for (const id of ids) {
        const res = await setToggle(instanceId, id, true);
        if (res.error) return setMessage({ text: res.error, missing: res.missing });
      }
    });

  const q = filter.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter features (name or F-number)…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {pending && <span className="text-sm text-gray-500">Saving…</span>}
      </div>
      {message && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>{message.text}</span>
          {message.missing?.length ? (
            <button
              onClick={() => turnOnAll(message.missing!)}
              className="rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-100"
            >
              Turn on {message.missing.join(", ")}
            </button>
          ) : null}
        </div>
      )}
      {groups.map(({ group, label, features }) => {
        const shown = features.filter((f) => !q || f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
        if (!shown.length) return null;
        return (
          <section key={group}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {shown.map((f) => {
                const on = !!optimistic[f.id];
                const blocked = on && !effective[f.id];
                const allowed = inPlan.has(f.id);
                const isLocked = lockedSet.has(f.id);
                return (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      role="switch"
                      aria-checked={on}
                      aria-label={`${f.id} ${f.name}`}
                      disabled={pending || (!allowed && !on)}
                      onClick={() => flip(f.id, !on)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-gray-900" : "bg-gray-300"} disabled:opacity-40`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${on ? "left-4.5" : "left-0.5"}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="mr-2 font-mono text-xs text-gray-500">{f.id}</span>
                        {f.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {f.requires.length ? `Requires ${f.requires.join(", ")}` : "No prerequisites"}
                        {!allowed && " · Not in plan"}
                        {blocked && <span className="text-amber-700"> · Inactive: a prerequisite is off</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => start(() => setToggleLock(instanceId, f.id, !isLocked))}
                      disabled={pending}
                      title={isLocked ? "Locked: the Store Owner can't change this" : "Lock so the Store Owner can't change it"}
                      className={`rounded px-2 py-1 text-xs ${isLocked ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                    >
                      {isLocked ? "🔒 Locked" : "Lock"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
