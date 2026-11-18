import "server-only";
import crypto from "node:crypto";
import type { StoreContext } from "./tenant";
import { storeModels } from "./tenant";
import { isSafeWebhookUrl } from "./url-safety";

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

export { isSafeWebhookUrl } from "./url-safety";
