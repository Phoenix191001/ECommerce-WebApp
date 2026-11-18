import "server-only";
import type { TenantModels } from "./models/tenant";

/**
 * F-41 email notifications. Sends through Resend when RESEND_API_KEY and EMAIL_FROM are set;
 * otherwise the message is stored in the instance's outbox so nothing is lost.
 */
export async function sendEmail(m: TenantModels, to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!to) return;
  if (!key || !from) {
    await m.Outbox.create({ to, subject, html, status: "logged" });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    await m.Outbox.create({
      to, subject, html,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? undefined : `${res.status} ${await res.text().catch(() => "")}`.slice(0, 500),
    });
  } catch (e) {
    await m.Outbox.create({ to, subject, html, status: "failed", error: String(e).slice(0, 500) });
  }
}

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
