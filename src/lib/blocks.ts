// F-116 page builder: a page is a list of blocks. Shared by the editor (client) and the renderer.

export type Block =
  | { type: "hero"; title: string; text: string; image: string; button: string; link: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption: string; link: string }
  | { type: "products"; title: string; category: string; tag: string; limit: number }
  | { type: "banner"; text: string; link: string; tone: "brand" | "dark" | "light" }
  | { type: "faq"; title: string; items: string } // "Question? | Answer" per line
  | { type: "columns"; items: string } // "Title | Text" per line, up to 4
  | { type: "video"; url: string };

export const BLOCK_TYPES: { type: Block["type"]; label: string; icon: string }[] = [
  { type: "hero", label: "Big banner", icon: "🖼️" },
  { type: "text", label: "Text", icon: "📝" },
  { type: "image", label: "Image", icon: "🏞️" },
  { type: "products", label: "Products", icon: "🛍️" },
  { type: "banner", label: "Strip", icon: "📢" },
  { type: "columns", label: "Columns", icon: "▦" },
  { type: "faq", label: "Questions", icon: "❓" },
  { type: "video", label: "YouTube video", icon: "▶️" },
];

export function newBlock(type: Block["type"]): Block {
  switch (type) {
    case "hero": return { type, title: "Your headline", text: "A short line about your store.", image: "", button: "Shop now", link: "/" };
    case "text": return { type, text: "Write something here." };
    case "image": return { type, url: "", caption: "", link: "" };
    case "products": return { type, title: "Featured products", category: "", tag: "", limit: 8 };
    case "banner": return { type, text: "Free delivery this week!", link: "", tone: "brand" };
    case "faq": return { type, title: "Questions", items: "How long is delivery? | 2–4 working days." };
    case "columns": return { type, items: "Fast delivery | Across Pakistan\nEasy returns | 7 days\nCash on delivery | Pay at your door" };
    case "video": return { type, url: "" };
  }
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const url = (v: unknown) => { const s = str(v, 1000).trim(); return /^https:\/\/\S+$/.test(s) ? s : ""; };
const link = (v: unknown) => { const s = str(v, 500).trim(); return /^(\/[^\s]*|https:\/\/\S+)$/.test(s) ? s : ""; };

/** Keep only known block types and fields, with safe lengths and links. */
export function cleanBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const b of raw.slice(0, 40) as Record<string, unknown>[]) {
    switch (b?.type) {
      case "hero": out.push({ type: "hero", title: str(b.title, 120), text: str(b.text, 400), image: url(b.image), button: str(b.button, 40), link: link(b.link) }); break;
      case "text": out.push({ type: "text", text: str(b.text, 10000) }); break;
      case "image": { const u = url(b.url); if (u) out.push({ type: "image", url: u, caption: str(b.caption, 200), link: link(b.link) }); break; }
      case "products": out.push({ type: "products", title: str(b.title, 120), category: str(b.category, 80), tag: str(b.tag, 40).toLowerCase(), limit: Math.max(1, Math.min(24, Math.floor(Number(b.limit)) || 8)) }); break;
      case "banner": out.push({ type: "banner", text: str(b.text, 200), link: link(b.link), tone: b.tone === "dark" || b.tone === "light" ? b.tone : "brand" }); break;
      case "faq": out.push({ type: "faq", title: str(b.title, 120), items: str(b.items, 5000) }); break;
      case "columns": out.push({ type: "columns", items: str(b.items, 2000) }); break;
      case "video": { const id = youtubeId(str(b.url, 300)); if (id) out.push({ type: "video", url: `https://www.youtube.com/watch?v=${id}` }); break; }
    }
  }
  return out;
}

export function youtubeId(u: string) {
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}
