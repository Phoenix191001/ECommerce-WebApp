export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";
export const btnCls =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50";
export const btnTealCls =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50";
export const btnSecondaryCls =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50";
export const btnDangerCls =
  "inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Card({
  title,
  children,
  actions,
  accent,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";
}) {
  const bar = accent
    ? { indigo: "from-indigo-500 to-violet-500", emerald: "from-emerald-500 to-teal-500", amber: "from-amber-400 to-orange-500", rose: "from-rose-500 to-pink-500", sky: "from-sky-500 to-cyan-500", violet: "from-violet-500 to-fuchsia-500" }[accent]
    : null;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {bar && <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bar}`} />}
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const STAT_TONES = {
  indigo: "from-indigo-500 to-violet-600",
  emerald: "from-emerald-500 to-teal-600",
  amber: "from-amber-400 to-orange-500",
  rose: "from-rose-500 to-pink-600",
  sky: "from-sky-500 to-blue-600",
  violet: "from-violet-500 to-fuchsia-600",
} as const;

export function Stat({ label, value, tone = "indigo", icon }: { label: string; value: React.ReactNode; tone?: keyof typeof STAT_TONES; icon?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${STAT_TONES[tone]} p-4 text-white shadow-md`}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/80">
        <span>{label}</span>
        {icon && <span className="text-lg" aria-hidden>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "sky" | "violet" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    indigo: "bg-indigo-100 text-indigo-800",
    sky: "bg-sky-100 text-sky-800",
    violet: "bg-violet-100 text-violet-800",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "rose" | "indigo" | "sky" | "violet"> = {
  active: "green",
  suspended: "amber",
  pending: "amber",
  confirmed: "sky",
  shipped: "indigo",
  delivered: "green",
  cancelled: "slate",
  refunded: "rose",
  paid: "green",
  unpaid: "amber",
  partially_refunded: "rose",
};

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error) return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>;
  if (state?.ok) return <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

export function Checklist({ items }: { items: { label: string; done: boolean; href?: string; hint?: string }[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ol className="space-y-2">
        {items.map((i, n) => (
          <li key={i.label} className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
              {i.done ? "✓" : n + 1}
            </span>
            <div className="text-sm">
              {i.href && !i.done ? (
                <a href={i.href} className="font-medium text-indigo-700 hover:underline">{i.label}</a>
              ) : (
                <span className={`font-medium ${i.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{i.label}</span>
              )}
              {i.hint && !i.done && <p className="text-xs text-slate-500">{i.hint}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-500">{done} of {items.length} done</p>
    </div>
  );
}
