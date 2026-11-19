"use client";

import { useEffect, useState } from "react";
import { subscribePush } from "@/app/s/[site]/shop-actions";
import type { Dict } from "@/lib/i18n";

function key(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** F-109: ask this browser for notifications about an order (or store offers). */
export function PushOptIn({ site, publicKey, order, token, marketing, L }: { site: string; publicKey: string; order?: number; token?: string; marketing?: boolean; L: Dict }) {
  const [state, setState] = useState<"idle" | "on" | "blocked" | "unsupported" | "busy">("idle");
  useEffect(() => {
    const t = setTimeout(() => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) setState("unsupported");
      else if (Notification.permission === "denied") setState("blocked");
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (state === "unsupported") return null;
  if (state === "on") return <p className="text-sm text-emerald-700">{L.pushOn}</p>;
  if (state === "blocked") return <p className="text-xs text-slate-500">{L.pushBlocked}</p>;
  return (
    <button
      type="button"
      disabled={state === "busy"}
      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
      onClick={async () => {
        setState("busy");
        try {
          if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
          const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          await navigator.serviceWorker.ready;
          const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(publicKey) }));
          const j = sub.toJSON();
          const r = await subscribePush(site, { endpoint: j.endpoint!, p256dh: j.keys!.p256dh, auth: j.keys!.auth }, { order, token, marketing });
          setState(r.ok ? "on" : "idle");
        } catch {
          setState("idle");
        }
      }}
    >
      {marketing ? L.pushOffers : L.pushNotify}
    </button>
  );
}
