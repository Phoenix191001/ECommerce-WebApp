export const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
export const btnCls =
  "inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50";
export const btnSecondaryCls =
  "inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error) return <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state?.ok) return <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.ok}</p>;
  return null;
}
