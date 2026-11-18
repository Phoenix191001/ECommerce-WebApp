import "server-only";

// F-89 / FR-U-05: attach a store's custom domain to this Vercel project.
// Needs VERCEL_API_TOKEN, VERCEL_PROJECT_ID and (for team projects) VERCEL_TEAM_ID.

const cfg = () => ({
  token: process.env.VERCEL_API_TOKEN,
  project: process.env.VERCEL_PROJECT_ID,
  team: process.env.VERCEL_TEAM_ID,
});

export const domainsConfigured = () => !!(cfg().token && cfg().project);

async function call(path: string, init?: RequestInit) {
  const { token, team } = cfg();
  const url = new URL(`https://api.vercel.com${path}`);
  if (team) url.searchParams.set("teamId", team);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function addProjectDomain(domain: string) {
  const r = await call(`/v10/projects/${cfg().project}/domains`, { method: "POST", body: JSON.stringify({ name: domain }) });
  if (!r.ok && r.body?.error?.code !== "domain_already_in_use_by_project")
    return { error: r.body?.error?.message ?? `Vercel returned ${r.status}.` };
  return {};
}

export async function removeProjectDomain(domain: string) {
  await call(`/v9/projects/${cfg().project}/domains/${encodeURIComponent(domain)}`, { method: "DELETE" });
}

export type DomainStatus = { verified: boolean; misconfigured: boolean; records: { type: string; name: string; value: string }[] };

export async function domainStatus(domain: string): Promise<DomainStatus | null> {
  const [d, c] = await Promise.all([
    call(`/v9/projects/${cfg().project}/domains/${encodeURIComponent(domain)}`),
    call(`/v6/domains/${encodeURIComponent(domain)}/config`),
  ]);
  if (!d.ok) return null;
  const apex = domain.split(".").length === 2;
  const records = [
    apex ? { type: "A", name: "@", value: "76.76.21.21" } : { type: "CNAME", name: domain.split(".")[0], value: "cname.vercel-dns.com" },
    ...((d.body?.verification as { type: string; domain: string; value: string }[] | undefined) ?? []).map((v) => ({
      type: v.type, name: v.domain, value: v.value,
    })),
  ];
  return { verified: !!d.body?.verified, misconfigured: !!c.body?.misconfigured, records };
}
