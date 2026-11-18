export function ManageAuthShell({ store, title, subtitle, children }: { store: { name: string }; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="bg-brand-gradient mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold shadow-lg">{store.name[0]}</div>
          <p className="text-lg font-bold">{store.name}</p>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Store panel</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-emerald-900/30">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-slate-600">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
