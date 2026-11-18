import "server-only";
import { headers } from "next/headers";
import type { StoreContext } from "./tenant";

/** Absolute origin + base path the current request used for this store. */
export async function absoluteBase(store: StoreContext) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}${store.base}`;
}

export const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
