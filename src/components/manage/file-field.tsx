"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

/** F-12: one downloadable file (PDF, ZIP, MP3…). Submits `${name}Url` and `${name}Name`. */
export function FileField({ name, initial, uploadUrl, folder }: { name: string; initial?: { url: string; name: string }; uploadUrl: string; folder: string }) {
  const [file, setFile] = useState(initial?.url ? initial : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pct, setPct] = useState(0);
  async function pick(f?: File) {
    if (!f) return;
    setError("");
    if (f.size > 200 * 1024 * 1024) return setError("Files can be up to 200 MB.");
    setBusy(true);
    setPct(0);
    try {
      const safe = f.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80) || "file";
      const b = await upload(`${folder}/${safe}`, f, { access: "public", handleUploadUrl: uploadUrl, multipart: f.size > 20 * 1024 * 1024, onUploadProgress: (e) => setPct(Math.round(e.percentage)) });
      setFile({ url: b.url, name: f.name });
    } catch (e) {
      setError(e instanceof Error && e.message.trim() ? e.message : "Upload failed. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <input type="hidden" name={`${name}Url`} value={file?.url ?? ""} />
      <input type="hidden" name={`${name}Name`} value={file?.name ?? ""} />
      {file && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          📄 <span className="flex-1 truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="text-xs text-rose-600 hover:underline">Remove</button>
        </p>
      )}
      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 ${busy ? "opacity-60" : ""}`}>
        ⬆️ {busy ? `Uploading… ${pct}%` : file ? "Replace file" : "Upload the file customers get"}
        <input type="file" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <p className="text-xs text-slate-500">PDF, ZIP, EPUB, MP3, MP4, Office files or images, up to 200 MB. Customers get the link once you confirm their order.</p>
    </div>
  );
}
