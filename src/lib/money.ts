// Money formatting shared by server and client components.

export const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export type DisplayCurrency = { code: string; rate: number } | null | undefined;

/** F-55: a price in the shopper's chosen currency, falling back to the store currency. */
export function showMoney(n: number, c: string, cur?: DisplayCurrency) {
  if (!cur) return money(n, c);
  const v = n * cur.rate;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur.code, maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v);
  } catch {
    return `${cur.code} ${v.toFixed(2)}`;
  }
}
