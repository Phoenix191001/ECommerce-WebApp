import "server-only";
import { cookies } from "next/headers";
import type { StoreContext } from "./tenant";
import { formatMoney } from "./tenant";

// F-55 multi-currency: prices are stored in the store currency; shoppers can view them in another
// currency the owner lists with a rate. The order is charged in the store currency, and records
// the currency and rate the shopper saw.

export const curCookie = (store: Pick<StoreContext, "id">) => `cur_${store.id}`;

export async function displayCurrency(store: StoreContext): Promise<{ code: string; rate: number } | null> {
  if (!store.features["F-55"]) return null;
  const code = (await cookies()).get(curCookie(store))?.value;
  const c = store.settings.currencies?.find((x) => x.code === code);
  return c && c.rate > 0 ? { code: c.code, rate: c.rate } : null;
}

/** Money formatter for storefront pages: "Rs 1,000" or, with a display currency, "$3.60". */
export async function shopMoney(store: StoreContext) {
  const cur = await displayCurrency(store);
  const fm = (n: number) => (cur ? convert(n, cur.code, cur.rate) : formatMoney(n, store.currency));
  return { fm, cur, base: (n: number) => formatMoney(n, store.currency) };
}

export function convert(n: number, code: string, rate: number) {
  const v = n * rate;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v);
  } catch {
    return `${code} ${v.toFixed(2)}`;
  }
}
