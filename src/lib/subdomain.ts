// FR-U-03: reject taken, reserved, or DNS-invalid subdomains.
export const RESERVED_SUBDOMAINS = new Set([
  "www", "admin", "api", "app", "dashboard", "mail", "email", "smtp", "ftp",
  "static", "assets", "cdn", "blog", "help", "support", "status", "docs",
  "billing", "auth", "login", "signup", "store", "shop", "platform", "s",
]);

const LABEL = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function validateSubdomain(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().toLowerCase();
  if (value.length < 3) return { ok: false, error: "Subdomain must be at least 3 characters." };
  if (!LABEL.test(value) || value.includes("--"))
    return {
      ok: false,
      error: "Use only lowercase letters, numbers, and single hyphens, and don't start or end with a hyphen.",
    };
  if (RESERVED_SUBDOMAINS.has(value))
    return { ok: false, error: `"${value}" is reserved. Choose a different subdomain.` };
  return { ok: true, value };
}

export const rootDomain = () => (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();

/** Public URL of a store: subdomain when a root domain is configured, path fallback otherwise. */
export function storeUrl(subdomain: string): string {
  const root = rootDomain();
  if (root.startsWith("localhost")) return `http://${subdomain}.${root}`;
  if (root.endsWith(".vercel.app")) return `/s/${subdomain}`;
  return `https://${subdomain}.${root}`;
}
