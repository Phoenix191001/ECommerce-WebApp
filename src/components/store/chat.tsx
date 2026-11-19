"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatPoll, chatSend, type ChatView } from "@/app/s/[site]/shop-actions";
import type { Dict } from "@/lib/i18n";

/** F-45: live chat bubble. Polls for replies while open (every 4 s) and now and then while closed. */
export function ChatWidget({ site, L, signedIn, raised }: { site: string; L: Dict; signedIn: boolean; raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ChatView>(null);
  const [text, setText] = useState("");
  const [who, setWho] = useState({ name: "", email: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const poll = useCallback(async () => { try { setView(await chatPoll(site)); } catch {} }, [site]);
  const started = !!view?.started;
  useEffect(() => {
    const first = setTimeout(poll, 0);
    // Shoppers who never chatted don't poll; others check for replies.
    const iv = open || started ? setInterval(() => { if (document.visibilityState === "visible") poll(); }, open ? 4000 : 30000) : undefined;
    return () => { clearTimeout(first); if (iv) clearInterval(iv); };
  }, [open, started, poll]);
  const count = view?.messages.length ?? 0;
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "end" }); }, [count, open]);
  const staffMsgs = view?.messages.filter((m) => m.from === "staff").length ?? 0;
  const unread = !open && view?.started && staffMsgs > seen;
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const r = await chatSend(site, text, who);
      if (r) { setView(r); if (r.error) setError(r.error); else setText(""); }
    } catch {
      setError("Couldn't send. Check your connection.");
    }
    setBusy(false);
  };
  return (
    <div className={`fixed end-5 z-40 ${raised ? "bottom-20" : "bottom-5"}`}>
      {open && (
        <div className="mb-3 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="bg-brand flex items-center justify-between px-4 py-3 text-white">
            <b>{L.chatOpen}</b>
            <button onClick={() => { setOpen(false); setSeen(staffMsgs); }} aria-label="Close chat" className="text-lg leading-none">✕</button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 text-sm">
            {view?.messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.from === "visitor" ? "bg-brand ms-auto text-white" : "bg-white shadow-sm"}`}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`mt-0.5 text-[10px] ${m.from === "visitor" ? "text-white/70" : "text-slate-400"}`}>{m.from === "visitor" ? L.you : m.name} · {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
            {view?.status === "closed" && <p className="text-center text-xs text-slate-500">{L.chatClosed}</p>}
            <div ref={end} />
          </div>
          <div className="space-y-2 border-t border-slate-200 p-3">
            {!view?.started && !signedIn && (
              <div className="grid grid-cols-2 gap-2">
                <input value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} placeholder={L.chatName} aria-label={L.chatName} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                <input value={who.email} onChange={(e) => setWho({ ...who, email: e.target.value })} placeholder={L.chatEmail} aria-label={L.chatEmail} type="email" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={L.chatPlaceholder} aria-label={L.chatPlaceholder} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button disabled={busy} className="btn-brand !px-3 !py-2">{L.chatSend}</button>
            </form>
            {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
          </div>
        </div>
      )}
      {!open && (
        <button onClick={() => { setOpen(true); setSeen(staffMsgs); }} className="bg-brand relative ms-auto flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-xl hover:brightness-110">
          {L.chatOpen}
          {unread && <span className="absolute -end-1 -top-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white" />}
        </button>
      )}
    </div>
  );
}
