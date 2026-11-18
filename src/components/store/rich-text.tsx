/** Renders owner-written plain text safely: "# " headings, "- " bullets, blank-line paragraphs. No HTML. */
export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-4 leading-relaxed text-slate-700">
      {blocks.map((b, i) => {
        if (/^#{1,3} /.test(b)) {
          const level = b.match(/^#+/)![0].length;
          const t = b.replace(/^#+ /, "");
          return level === 1 ? <h2 key={i} className="text-2xl font-bold text-slate-900">{t}</h2> : <h3 key={i} className="text-xl font-semibold text-slate-900">{t}</h3>;
        }
        const lines = b.split("\n");
        if (lines.every((l) => /^[-*] /.test(l))) return <ul key={i} className="list-disc space-y-1 ps-6">{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>;
        return <p key={i} className="whitespace-pre-line">{b}</p>;
      })}
    </div>
  );
}
