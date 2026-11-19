"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chatInbox, chatReply, chatSetStatus, type Inbox } from "@/app/s/[site]/manage/chat-actions";

/** F-45: staff side of live chat. Refreshes every 5 seconds. */
export function ChatInbox({ site, initial }: { site: string; initial: Inbox }) {
  const [box, setBox] = useState(initial);
  const [sel, setSel] = useState<string | undefined>(initial.open?.id);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async (id?: string) => { try { setBox(await chatInbox(site, id)); } catch {} }, [site]);
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === "visible") load(sel); }, 5000);
    return () => clearInterval(iv);
  }, [load, sel]);
  const n = box.open?.messages.length ?? 0;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [n, sel]);
  const open = box.open && box.open.id === sel ? box.open : undefined;
  const unread = box.threads.filter((t) => t.unread).length;
  useEffect(() => { document.title = unread ? `(${unread}) Live chat` : "Live chat"; }, [unread]);
  return (
    <div className="grid min-h-[32rem] gap-4 md:grid-cols-[18rem_1fr]">
      <ul className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto rounded-2xl bg-white shadow-sm">
        {box.threads.length === 0 && <li className="p-4 text-sm text-slate-500">No chats yet. The chat bubble shows on every page of your store.</li>}
        {box.threads.map((t) => (
          <li key={t.id}>
            <button onClick={() => { setSel(t.id); load(t.id); }} className={`w-full p-3 text-start text-sm hover:bg-slate-50 ${sel === t.id ? "bg-emerald-50" : ""}`}>
              <span className="flex items-center gap-2">
                {t.unread && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                <b className="truncate">{t.name}</b>
                <span className="ms-auto text-[11px] text-slate-400">{new Date(t.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </span>
              <span className={`block truncate text-xs ${t.status === "closed" ? "text-slate-400" : "text-slate-600"}`}>{t.last}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col rounded-2xl bg-white shadow-sm">
        {!open ? <p className="m-auto text-sm text-slate-500">Choose a chat.</p> : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm">
              <b>{open.name}</b>{open.email && <a href={`mailto:${open.email}`} className="text-emerald-700">{open.email}</a>}
              <button onClick={async () => { await chatSetStatus(site, open.id, open.status === "open" ? "closed" : "open"); load(open.id); }} className="ms-auto text-xs text-slate-600 hover:underline">{open.status === "open" ? "✔ Close chat" : "Reopen"}</button>
            </div>
            <div className="max-h-[26rem] flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4 text-sm">
              {open.messages.map((m, i) => (
                <div key={i} className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.from === "staff" ? "ms-auto bg-emerald-600 text-white" : "bg-white shadow-sm"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-0.5 text-[10px] ${m.from === "staff" ? "text-white/70" : "text-slate-400"}`}>{m.name} · {new Date(m.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              ))}
              <div ref={end} />
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErr("");
                const r = await chatReply(site, open.id, text);
                if (r.error) setErr(r.error);
                else { setText(""); load(open.id); }
              }}
              className="flex gap-2 border-t border-slate-100 p-3"
            >
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type a reply…" aria-label="Reply" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" autoFocus />
              <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Send</button>
            </form>
            {err && <p className="px-3 pb-2 text-xs text-rose-600">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
