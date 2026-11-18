// F-96 typo-tolerant search: rank names by edit distance to the query's words.

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** 0 = perfect. Each query word is matched to its closest word in the text (or a prefix of it). */
export function fuzzyScore(query: string, text: string): number {
  const qw = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tw = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!qw.length || !tw.length) return Infinity;
  let total = 0;
  for (const q of qw) {
    let best = Infinity;
    for (const w of tw) best = Math.min(best, lev(q, w), lev(q, w.slice(0, q.length)) + 0.5);
    const allowed = q.length <= 3 ? 0 : q.length <= 6 ? 1 : 2;
    if (best > allowed) return Infinity;
    total += best;
  }
  return total;
}
