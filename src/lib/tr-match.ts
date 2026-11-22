// Looks up a translation by its English text. Keys may hold placeholders like {0} for parts that
// change (amounts, names, numbers): "Refunded {0}." matches "Refunded Rs 500." and the value is
// put into the same place in the translation. A message made of several sentences that has no
// entry of its own is translated sentence by sentence. Anything not found stays in English.

type Tpl = { re: RegExp; to: string };
const cache = new WeakMap<Record<string, string>, Tpl[]>();

function templates(dict: Record<string, string>): Tpl[] {
  let t = cache.get(dict);
  if (!t) {
    t = Object.keys(dict)
      .filter((k) => /\{\d\}/.test(k))
      .sort((a, b) => b.length - a.length)
      .map((k) => ({
        re: new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{(\d)\\\}/g, "(?<p$1>(?:(?![.!?]\\s+[A-Z])[\\s\\S])+?)")}$`),
        to: dict[k],
      }));
    cache.set(dict, t);
  }
  return t;
}

function one(dict: Record<string, string>, s: string): string | undefined {
  if (dict[s] !== undefined) return dict[s];
  for (const { re, to } of templates(dict)) {
    const m = re.exec(s);
    if (m) return to.replace(/\{(\d)\}/g, (_, n) => m.groups?.[`p${n}`] ?? "");
  }
  return undefined;
}

export function translate(dict: Record<string, string>, s: string): string {
  if (!s) return s;
  const whole = one(dict, s);
  if (whole !== undefined) return whole;
  const parts = s.split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/);
  if (parts.length < 2) return s;
  return parts.map((p) => one(dict, p) ?? p).join(" ");
}
