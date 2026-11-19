"use client";

import { useEffect, useState } from "react";

/** F-114 "Recent sales pop-up": cycles through real recent orders (city and product only). */
export function SalesPop({ sales }: { sales: { city: string; name: string; ago: number }[] }) {
  const [i, setI] = useState(-1);
  useEffect(() => {
    let n = 0;
    const show = () => { setI(n % sales.length); n++; setTimeout(() => setI(-1), 6000); };
    const first = setTimeout(show, 8000);
    const iv = setInterval(show, 25000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [sales.length]);
  if (i < 0) return null;
  const s = sales[i];
  const ago = s.ago < 60 ? `${s.ago} min ago` : s.ago < 1440 ? `${Math.round(s.ago / 60)} h ago` : `${Math.round(s.ago / 1440)} days ago`;
  return (
    <div role="status" className="fixed bottom-5 start-5 z-40 max-w-xs rounded-2xl bg-white p-3 text-sm shadow-2xl ring-1 ring-slate-200 motion-safe:animate-[fadeIn_.3s_ease-out]">
      🛍️ Someone{s.city ? ` in ${s.city}` : ""} bought <b>{s.name}</b>
      <span className="block text-xs text-slate-500">{ago}</span>
    </div>
  );
}
