"use client";

import { useState } from "react";
import { BLOCK_TYPES, newBlock, type Block } from "@/lib/blocks";
import { inputCls } from "@/components/admin/ui";
import { usePT } from "@/components/manage/panel-lang";

const input = inputCls.replaceAll("indigo", "emerald");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs font-medium text-slate-600">{label}{children}</label>;
}

/** F-116: build a page from blocks. Drag a block by its handle (or use ↑ ↓) to reorder. */
export function PageBuilder({ initial, categories }: { initial: Block[]; categories: string[] }) {
  const T = usePT();
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const set = (i: number, patch: Partial<Block>) => setBlocks((b) => b.map((x, j) => (j === i ? ({ ...x, ...patch } as Block) : x)));
  const move = (from: number, to: number) => setBlocks((b) => {
    if (to < 0 || to >= b.length || from === to) return b;
    const next = [...b];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
  });
  const field = (i: number, b: Block, k: string, label: string, opts?: { area?: boolean; type?: string; placeholder?: string }) => {
    const v = (b as Record<string, unknown>)[k];
    const common = { value: String(v ?? ""), placeholder: opts?.placeholder, className: `${input} ${opts?.area ? "font-mono text-xs" : ""}`, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(i, { [k]: opts?.type === "number" ? Number(e.target.value) : e.target.value } as Partial<Block>) };
    return <Row label={label}>{opts?.area ? <textarea rows={4} {...common} /> : <input type={opts?.type ?? "text"} {...common} />}</Row>;
  };
  return (
    <div className="space-y-3">
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      {blocks.length === 0 && <p className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{T("No blocks yet. Add one below. (Without blocks, the page shows its text.)")}</p>}
      <ol className="space-y-3">
        {blocks.map((b, i) => {
          const meta = BLOCK_TYPES.find((t) => t.type === b.type)!;
          return (
            <li
              key={i}
              onDragOver={(e) => { e.preventDefault(); setOver(i); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
              className={`rounded-xl border bg-white p-3 shadow-sm ${over === i && drag !== null && drag !== i ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"} ${drag === i ? "opacity-50" : ""}`}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span draggable onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }} className="cursor-grab select-none rounded px-1 text-slate-400 hover:bg-slate-100" title={T("Drag to move")} aria-hidden>⠿</span>
                <span>{meta.icon} {meta.label}</span>
                <span className="ms-auto flex gap-1">
                  <button type="button" onClick={() => move(i, i - 1)} className="rounded border px-1.5 text-xs" aria-label={T("Move up")}>↑</button>
                  <button type="button" onClick={() => move(i, i + 1)} className="rounded border px-1.5 text-xs" aria-label={T("Move down")}>↓</button>
                  <button type="button" onClick={() => setBlocks((x) => x.filter((_, j) => j !== i))} className="rounded border border-rose-200 px-1.5 text-xs text-rose-600" aria-label={T("Remove block")}>✕</button>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {b.type === "hero" && <>{field(i, b, "title", "Headline")}{field(i, b, "text", "Text")}{field(i, b, "image", "Background image (https:// link)")}<div className="grid grid-cols-2 gap-2">{field(i, b, "button", "Button")}{field(i, b, "link", "Button link", { placeholder: "/ or /p/…" })}</div></>}
                {b.type === "text" && <div className="sm:col-span-2">{field(i, b, "text", "Text (blank line = new paragraph, # heading, - bullet)", { area: true })}</div>}
                {b.type === "image" && <>{field(i, b, "url", "Image (https:// link)")}{field(i, b, "caption", "Caption")}{field(i, b, "link", "Link when tapped (optional)")}</>}
                {b.type === "products" && (
                  <>
                    {field(i, b, "title", "Heading")}
                    <Row label={T("Category")}>
                      <select value={b.category} onChange={(e) => set(i, { category: e.target.value })} className={input}>
                        <option value="">{T("Newest products")}</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Row>
                    {field(i, b, "tag", "Or a tag")}
                    {field(i, b, "limit", "How many", { type: "number" })}
                  </>
                )}
                {b.type === "banner" && (
                  <>
                    {field(i, b, "text", "Text")}{field(i, b, "link", "Link (optional)")}
                    <Row label={T("Colour")}>
                      <select value={b.tone} onChange={(e) => set(i, { tone: e.target.value as "brand" | "dark" | "light" })} className={input}>
                        <option value="brand">{T("Store colour")}</option><option value="dark">{T("Dark")}</option><option value="light">{T("Light")}</option>
                      </select>
                    </Row>
                  </>
                )}
                {b.type === "columns" && <div className="sm:col-span-2">{field(i, b, "items", "One per line: Title | Text (up to 4)", { area: true })}</div>}
                {b.type === "faq" && <>{field(i, b, "title", "Heading")}<div className="sm:col-span-2">{field(i, b, "items", "One per line: Question? | Answer", { area: true })}</div></>}
                {b.type === "video" && <div className="sm:col-span-2">{field(i, b, "url", "YouTube link")}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((t) => (
          <button key={t.type} type="button" onClick={() => setBlocks((x) => [...x, newBlock(t.type)])} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
            ➕ {t.icon} {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
