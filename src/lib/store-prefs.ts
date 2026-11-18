import "server-only";
import { cookies } from "next/headers";
import { DICTS, type Dict, type Lang } from "./i18n";
import type { StoreContext } from "./tenant";

/** Shopper's language (F-16) and theme (F-87) for a store. */
export async function storePrefs(store: StoreContext): Promise<{ lang: Lang; t: Dict; dir: "ltr" | "rtl"; dark: boolean }> {
  const jar = await cookies();
  const lang: Lang = store.features["F-16"] && jar.get(`lang_${store.id}`)?.value === "ur" ? "ur" : "en";
  const dark = !!store.features["F-87"] && jar.get(`theme_${store.id}`)?.value === "dark";
  return { lang, t: DICTS[lang], dir: lang === "ur" ? "rtl" : "ltr", dark };
}
