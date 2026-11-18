export function AuthShell({ title, subtitle, step, children }: { title: string; subtitle: string; step?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-600 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">🛍️</div>
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Platform Admin</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-indigo-900/30">
          {step && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-600">{step}</p>}
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-slate-600">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
