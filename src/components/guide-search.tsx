"use client";

import { useEffect, useState } from "react";

/** Filters the feature map in place by name, F-number, or description. */
export function GuideSearch() {
  const [q, setQ] = useState("");
  useEffect(() => {
    const term = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>("#feature-list [data-search]").forEach((el) => {
      el.style.display = !term || el.dataset.search!.includes(term) ? "" : "none";
    });
    document.querySelectorAll<HTMLElement>("#feature-list [data-group]").forEach((g) => {
      const any = [...g.querySelectorAll<HTMLElement>("[data-search]")].some((el) => el.style.display !== "none");
      g.style.display = any ? "" : "none";
    });
  }, [q]);
  return (
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="🔎 Search features: “wishlist”, “F-34”, “refund”…"
      className="mb-6 w-full max-w-lg rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
      aria-label="Search features"
    />
  );
}
