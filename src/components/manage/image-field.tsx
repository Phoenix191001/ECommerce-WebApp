"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { usePT } from "@/components/manage/panel-lang";

/**
 * Pick photos from the device (uploaded to Vercel Blob) or paste image links.
 * The chosen URLs are submitted as one hidden field, one URL per line.
 */
export function ImageField({
  name, initial = [], uploadUrl, folder, max = 12, single = false, onChange,
}: {
  name: string;
  initial?: string[];
  uploadUrl: string;
  folder: string;
  max?: number;
  single?: boolean;
  /** Called whenever the chosen images change (for live previews). */
  onChange?: (urls: string[]) => void;
}) {
  const T = usePT();
  const [urls, setUrls] = useState<string[]>(initial.filter(Boolean));
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const limit = single ? 1 : max;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    onChange?.(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls]);

  const add = (u: string) => setUrls((cur) => (single ? [u] : cur.includes(u) ? cur : [...cur, u].slice(0, limit)));

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files).slice(0, single ? 1 : Math.max(0, limit - urls.length));
    if (!list.length) return setError(`You can add up to ${limit} images.`);
    for (const f of list) {
      if (!f.type.startsWith("image/")) { setError(`${f.name} isn't an image.`); continue; }
      if (f.size > 5 * 1024 * 1024) { setError(`${f.name} is larger than 5 MB.`); continue; }
      setBusy((n) => n + 1);
      try {
        const safe = f.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60) || "image";
        const blob = await upload(`${folder}/${safe}`, f, { access: "public", handleUploadUrl: uploadUrl });
        add(blob.url);
      } catch (e) {
        setError(e instanceof Error && e.message.trim() ? e.message : "Upload failed. Check your internet connection and try again.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  const move = (i: number, d: -1 | 1) =>
    setUrls((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={urls.join("\n")} />
      {urls.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <li key={u} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" />
              {!single && i === 0 && <span className="absolute start-1 top-1 rounded bg-emerald-600 px-1 text-[10px] font-semibold text-white">{T("Main")}</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 px-1 py-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                {!single && <button type="button" onClick={() => move(i, -1)} className="text-xs text-white" aria-label={T("Move left")}>◀</button>}
                <button type="button" onClick={() => setUrls((cur) => cur.filter((x) => x !== u))} className="text-xs text-white" aria-label={T("Remove image")}>✕</button>
                {!single && <button type="button" onClick={() => move(i, 1)} className="text-xs text-white" aria-label={T("Move right")}>▶</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 ${busy ? "opacity-60" : ""}`}>
          📷 {busy ? `Uploading ${busy}…` : single ? T("Upload image") : T("Upload photos")}
          <input ref={input} type="file" accept="image/*" multiple={!single} className="sr-only" disabled={!!busy} onChange={(e) => onFiles(e.target.files)} />
        </label>
        <span className="text-xs text-slate-500">{T("or")}</span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={T("Paste an image link (https://…)")}
          className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          aria-label={T("Image link")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (/^https?:\/\/\S+$/i.test(link.trim())) { add(link.trim()); setLink(""); }
            }
          }}
        />
        <button type="button" onClick={() => { if (/^https?:\/\/\S+$/i.test(link.trim())) { add(link.trim()); setLink(""); } else setError("Paste a full link starting with https://"); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">{T("Add link")}</button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <p className="text-xs text-slate-500">{single ? "JPG, PNG, WebP or GIF, up to 5 MB." : `Up to ${limit} images, 5 MB each. The first is the main photo; reorder with ◀ ▶.`}</p>
    </div>
  );
}
