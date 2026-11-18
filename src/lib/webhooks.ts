import "server-only";
import crypto from "node:crypto";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";

export const WEBHOOK_EVENTS = ["order.created", "order.status_changed", "order.refunded", "product.updated"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * F-112: POST the event to every active webhook that subscribes to it. The body is signed with
 * HMAC-SHA256 in the X-Signature header so receivers can verify it came from this store.
 */
export async function fireWebhook(store: StoreContext, event: WebhookEvent, data: unknown) {
  if (!store.features["F-112"]) return;
  const m = await storeModels(store);
  const hooks = await m.Webhook.find({ active: true, events: event }).lean();
  if (!hooks.length) return;
  const body = JSON.stringify({ event, store: store.subdomain, at: new Date().toISOString(), data });
  await Promise.all(
    hooks.map(async (h) => {
      if (!isSafeWebhookUrl(h.url)) return;
      const sig = crypto.createHmac("sha256", h.secret).update(body).digest("hex");
      let status: string;
      try {
        const res = await fetch(h.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Event": event, "X-Signature": `sha256=${sig}` },
          body,
          signal: AbortSignal.timeout(5000),
        });
        status = String(res.status);
      } catch (e) {
        status = `error: ${String(e).slice(0, 80)}`;
      }
      await m.Webhook.updateOne({ _id: h._id }, { $set: { lastStatus: status, lastAt: new Date() } });
    }),
  );
}

/** Only public HTTPS endpoints: blocks localhost, private ranges and metadata IPs (basic SSRF guard). */
export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  if (h.includes(":")) return false; // IPv6 literals
  return true;
}
