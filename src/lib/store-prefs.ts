import "server-only";
import { cookies } from "next/headers";
import { DICTS, type Dict, type Lang } from "./i18n";
import { dirOf, isLang, LANG_CODES } from "./languages";
import type { StoreContext } from "./tenant";

/** Languages this store offers shoppers (F-16). Always includes English. */
export function storeLanguages(store: StoreContext): Lang[] {
  if (!store.features["F-16"]) return ["en"];
  const picked = (store.settings.languages ?? []).filter(isLang);
  return LANG_CODES.filter((c) => c === "en" || picked.includes(c));
}

/** Shopper's language (F-16) and theme (F-87) for a store. */
export async function storePrefs(store: StoreContext): Promise<{ lang: Lang; t: Dict; dir: "ltr" | "rtl"; dark: boolean; langs: Lang[] }> {
  const jar = await cookies();
  const langs = storeLanguages(store);
  const chosen = jar.get(`lang_${store.id}`)?.value;
  const fallback = isLang(store.settings.defaultLang) && langs.includes(store.settings.defaultLang) ? store.settings.defaultLang : "en";
  const lang: Lang = isLang(chosen) && langs.includes(chosen) ? chosen : fallback;
  const dark = !!store.features["F-87"] && jar.get(`theme_${store.id}`)?.value === "dark";
  return { lang, t: DICTS[lang], dir: dirOf(lang), dark, langs };
}
