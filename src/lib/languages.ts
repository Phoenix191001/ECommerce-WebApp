// Languages the platform speaks. Shared by the storefront and the store panel (no server code).

export const LANGS = [
  { code: "en", name: "English", native: "English", dir: "ltr", locale: "en-GB" },
  { code: "ur", name: "Urdu", native: "اردو", dir: "rtl", locale: "ur-PK" },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl", locale: "ar" },
  { code: "hi", name: "Hindi", native: "हिन्दी", dir: "ltr", locale: "hi-IN" },
  { code: "pa", name: "Punjabi (Shahmukhi)", native: "پنجابی", dir: "rtl", locale: "pa-Arab-PK" },
  { code: "zh", name: "Chinese (Simplified)", native: "中文", dir: "ltr", locale: "zh-CN" },
] as const;

export type LangCode = (typeof LANGS)[number]["code"];
export const LANG_CODES = LANGS.map((l) => l.code) as LangCode[];
export const isLang = (v: unknown): v is LangCode => typeof v === "string" && (LANG_CODES as string[]).includes(v);
export const langInfo = (c: LangCode) => LANGS.find((l) => l.code === c)!;
export const dirOf = (c: LangCode): "ltr" | "rtl" => langInfo(c).dir;
/** Locale for dates and numbers; Intl falls back sensibly if the platform lacks one. */
export const dateLocale = (c: LangCode) => langInfo(c).locale;
