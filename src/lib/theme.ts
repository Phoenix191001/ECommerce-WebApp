// Store design (F-15): colours for each part of the storefront, fonts, images and shape.
// Saved on the store as branding.theme; the storefront turns it into CSS variables.

export type Theme = {
  preset: string;
  bg: string; surface: string; text: string; muted: string; border: string;
  header: string; headerText: string; footer: string; footerText: string;
  button: string; buttonText: string; link: string; sale: string;
  announce: string; announceText: string; heroFrom: string; heroTo: string; heroText: string;
  font: FontId; headingFont: FontId;
  radius: Radius; grid: 2 | 3 | 4; width: "boxed" | "wide"; cardStyle: "shadow" | "border" | "flat";
  heroImage: string; heroTitle: string; heroSubtitle: string; heroButton: string; heroAlign: "start" | "center";
  bgImage: string; favicon: string;
};

export type Radius = "none" | "small" | "medium" | "large" | "pill";
export const RADII: Record<Radius, string> = { none: "0px", small: "6px", medium: "12px", large: "20px", pill: "28px" };

export const FONTS = {
  system: { label: "System (fast)", css: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', google: "" },
  inter: { label: "Inter", css: '"Inter", sans-serif', google: "Inter:wght@400;500;600;700;800" },
  poppins: { label: "Poppins", css: '"Poppins", sans-serif', google: "Poppins:wght@400;500;600;700;800" },
  montserrat: { label: "Montserrat", css: '"Montserrat", sans-serif', google: "Montserrat:wght@400;500;600;700;800" },
  dmsans: { label: "DM Sans", css: '"DM Sans", sans-serif', google: "DM+Sans:wght@400;500;700" },
  playfair: { label: "Playfair Display (elegant)", css: '"Playfair Display", serif', google: "Playfair+Display:wght@500;600;700;800" },
  lora: { label: "Lora (classic)", css: '"Lora", serif', google: "Lora:wght@400;500;600;700" },
  oswald: { label: "Oswald (bold)", css: '"Oswald", sans-serif', google: "Oswald:wght@400;500;600;700" },
  nunito: { label: "Nunito (friendly)", css: '"Nunito", sans-serif', google: "Nunito:wght@400;600;700;800" },
  mono: { label: "Space Mono (techy)", css: '"Space Mono", monospace', google: "Space+Mono:wght@400;700" },
} as const;
export type FontId = keyof typeof FONTS;

const base: Omit<Theme, "preset"> = {
  bg: "#f8fafc", surface: "#ffffff", text: "#0f172a", muted: "#64748b", border: "#e2e8f0",
  header: "#ffffff", headerText: "#0f172a", footer: "#ffffff", footerText: "#64748b",
  button: "#4f46e5", buttonText: "#ffffff", link: "#4f46e5", sale: "#e11d48",
  announce: "#4f46e5", announceText: "#ffffff", heroFrom: "#4f46e5", heroTo: "#db2777", heroText: "#ffffff",
  font: "system", headingFont: "system",
  radius: "large", grid: 4, width: "boxed", cardStyle: "shadow",
  heroImage: "", heroTitle: "", heroSubtitle: "", heroButton: "", heroAlign: "start",
  bgImage: "", favicon: "",
};

/** Ready-made looks. Picking one fills in every setting; owners can then change any of them. */
export const PRESETS: Record<string, { name: string; theme: Omit<Theme, "preset"> }> = {
  classic: { name: "Classic", theme: base },
  midnight: {
    name: "Midnight",
    theme: { ...base, bg: "#0b1120", surface: "#111827", text: "#f1f5f9", muted: "#94a3b8", border: "#1f2937", header: "#0b1120", headerText: "#f8fafc", footer: "#0b1120", footerText: "#94a3b8", button: "#22d3ee", buttonText: "#0b1120", link: "#22d3ee", announce: "#22d3ee", announceText: "#0b1120", heroFrom: "#0f172a", heroTo: "#0e7490", font: "inter", headingFont: "inter", radius: "medium", cardStyle: "border" },
  },
  boutique: {
    name: "Boutique",
    theme: { ...base, bg: "#fbf7f4", surface: "#ffffff", text: "#3f2d2a", muted: "#8a7570", border: "#eaded8", header: "#fbf7f4", headerText: "#3f2d2a", footer: "#3f2d2a", footerText: "#eaded8", button: "#9f5f4b", buttonText: "#ffffff", link: "#9f5f4b", sale: "#b4413b", announce: "#3f2d2a", announceText: "#fbf7f4", heroFrom: "#a8705b", heroTo: "#7d4b3d", font: "lora", headingFont: "playfair", radius: "small", grid: 3, cardStyle: "flat", heroAlign: "center" },
  },
  fresh: {
    name: "Fresh grocery",
    theme: { ...base, bg: "#f6fbf4", border: "#dcefd6", header: "#16a34a", headerText: "#ffffff", footer: "#14532d", footerText: "#dcfce7", button: "#16a34a", link: "#15803d", sale: "#ea580c", announce: "#facc15", announceText: "#14532d", heroFrom: "#16a34a", heroTo: "#84cc16", font: "nunito", headingFont: "nunito", radius: "large" },
  },
  bold: {
    name: "Bold streetwear",
    theme: { ...base, bg: "#ffffff", surface: "#ffffff", text: "#000000", muted: "#525252", border: "#000000", header: "#000000", headerText: "#ffffff", footer: "#000000", footerText: "#d4d4d4", button: "#000000", buttonText: "#ffffff", link: "#000000", sale: "#ef4444", announce: "#facc15", announceText: "#000000", heroFrom: "#111111", heroTo: "#404040", font: "inter", headingFont: "oswald", radius: "none", grid: 3, cardStyle: "border" },
  },
  candy: {
    name: "Candy",
    theme: { ...base, bg: "#fff7fb", border: "#fbcfe8", header: "#ffffff", headerText: "#9d174d", footer: "#fdf2f8", footerText: "#9d174d", button: "#ec4899", link: "#db2777", announce: "#a855f7", heroFrom: "#db2777", heroTo: "#9333ea", font: "poppins", headingFont: "poppins", radius: "pill" },
  },
  luxury: {
    name: "Luxury gold",
    theme: { ...base, bg: "#0c0a09", surface: "#1c1917", text: "#f5f5f4", muted: "#a8a29e", border: "#292524", header: "#0c0a09", headerText: "#e7c873", footer: "#0c0a09", footerText: "#a8a29e", button: "#d4af37", buttonText: "#0c0a09", link: "#e7c873", sale: "#f87171", announce: "#d4af37", announceText: "#0c0a09", heroFrom: "#1c1917", heroTo: "#57534e", heroText: "#f5e6b8", font: "montserrat", headingFont: "playfair", radius: "none", grid: 3, cardStyle: "flat", heroAlign: "center" },
  },
  ocean: {
    name: "Ocean",
    theme: { ...base, bg: "#f0f9ff", border: "#bae6fd", header: "#0c4a6e", headerText: "#ffffff", footer: "#0c4a6e", footerText: "#bae6fd", button: "#0284c7", link: "#0369a1", announce: "#0369a1", heroFrom: "#0284c7", heroTo: "#14b8a6", font: "dmsans", headingFont: "dmsans", radius: "medium" },
  },
};

export const DEFAULT_THEME: Theme = { preset: "classic", ...base };

const HEX = /^#[0-9a-fA-F]{6}$/;
const COLOR_KEYS = ["bg", "surface", "text", "muted", "border", "header", "headerText", "footer", "footerText", "button", "buttonText", "link", "sale", "announce", "announceText", "heroFrom", "heroTo", "heroText"] as const;
const IMG = /^https:\/\/[^\s"'()<>\\]+$/;

/** Keeps only valid values; anything missing or wrong falls back to the default. */
export function cleanTheme(raw: unknown, fallbackButton?: string): Theme {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const t: Theme = { ...DEFAULT_THEME, ...(fallbackButton && HEX.test(fallbackButton) ? { button: fallbackButton, link: fallbackButton, announce: fallbackButton, heroFrom: fallbackButton } : {}) };
  for (const k of COLOR_KEYS) if (typeof r[k] === "string" && HEX.test(r[k] as string)) t[k] = r[k] as string;
  const str = (k: "heroTitle" | "heroSubtitle" | "heroButton", max: number) => { if (typeof r[k] === "string") t[k] = (r[k] as string).trim().slice(0, max); };
  str("heroTitle", 80); str("heroSubtitle", 200); str("heroButton", 30);
  for (const k of ["heroImage", "bgImage", "favicon"] as const) if (typeof r[k] === "string") t[k] = IMG.test(r[k] as string) ? (r[k] as string) : "";
  if (typeof r.font === "string" && r.font in FONTS) t.font = r.font as FontId;
  if (typeof r.headingFont === "string" && r.headingFont in FONTS) t.headingFont = r.headingFont as FontId;
  if (typeof r.radius === "string" && r.radius in RADII) t.radius = r.radius as Radius;
  if ([2, 3, 4].includes(Number(r.grid))) t.grid = Number(r.grid) as 2 | 3 | 4;
  if (r.width === "wide" || r.width === "boxed") t.width = r.width;
  if (r.cardStyle === "shadow" || r.cardStyle === "border" || r.cardStyle === "flat") t.cardStyle = r.cardStyle;
  if (r.heroAlign === "start" || r.heroAlign === "center") t.heroAlign = r.heroAlign;
  if (typeof r.preset === "string" && (r.preset in PRESETS || r.preset === "custom")) t.preset = r.preset;
  return t;
}

/** CSS variables for a theme, set on the storefront's outer element. */
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--brand": t.button,
    "--st-bg": t.bg, "--st-surface": t.surface, "--st-text": t.text, "--st-muted": t.muted, "--st-border": t.border,
    "--st-header": t.header, "--st-header-text": t.headerText, "--st-footer": t.footer, "--st-footer-text": t.footerText,
    "--st-button": t.button, "--st-button-text": t.buttonText, "--st-link": t.link, "--st-sale": t.sale,
    "--st-announce": t.announce, "--st-announce-text": t.announceText,
    "--st-hero-from": t.heroFrom, "--st-hero-to": t.heroTo, "--st-hero-text": t.heroText,
    "--st-font": FONTS[t.font].css, "--st-heading-font": FONTS[t.headingFont].css,
    "--st-radius": RADII[t.radius], "--st-width": t.width === "wide" ? "96rem" : "72rem",
    "--st-bg-image": t.bgImage ? `url("${t.bgImage}")` : "none",
    "--st-cols": String(t.grid),
  };
}

/** Google Fonts stylesheet for the fonts a theme uses, or "" for system fonts only. */
export function fontHref(t: Theme): string {
  const fams = [...new Set([FONTS[t.font].google, FONTS[t.headingFont].google].filter(Boolean))];
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&")}&display=swap` : "";
}

/** Readable text colour (black or white) on a background. */
export function contrastText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#000000" : "#ffffff";
}

/** The store's design when it has one saved and theme switching (F-15) is on; otherwise null. */
export function storeTheme(store: { features: Record<string, boolean>; branding: { primaryColor: string; theme?: Record<string, unknown> | null } }): Theme | null {
  return store.features["F-15"] && store.branding.theme ? cleanTheme(store.branding.theme, store.branding.primaryColor) : null;
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio between two colours (1 = same, 21 = black on white). */
export const contrastRatio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** Text/background pairs that are hard to read (below 3:1), as [text key, background key, part name]. */
export const READ_PAIRS = [
  ["text", "bg", "Page text"], ["text", "surface", "Text on cards"], ["headerText", "header", "Header"], ["footerText", "footer", "Footer"],
  ["buttonText", "button", "Buttons"], ["announceText", "announce", "Announcement bar"], ["heroText", "heroFrom", "Top banner"],
] as const;
export const hardToRead = (t: Theme) => READ_PAIRS.filter(([fg, bg]) => contrastRatio(t[fg], t[bg]) < 3);
