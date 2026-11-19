import "server-only";
import webpush from "web-push";
import type { TenantModels } from "./models/tenant";
import type { StoreContext } from "./tenant";

// F-109 web push. Needs VAPID keys (generated once for the platform, no outside account):
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and optionally VAPID_SUBJECT (mailto: or https: URL).

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready || !pushConfigured()) return ready;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
  return true;
}

type Payload = { title: string; body: string; url: string };

async function send(m: TenantModels, subs: { _id: unknown; endpoint: string; p256dh: string; auth: string }[], p: Payload) {
  if (!setup()) return 0;
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await m.PushSub.deleteOne({ _id: s._id }); // unsubscribed in the browser
      }
    }),
  );
  return sent;
}

const STATUS_TEXT: Record<string, string> = {
  confirmed: "is confirmed ✅", shipped: "is on the way 🚚", delivered: "was delivered 📦", cancelled: "was cancelled", partly: "is partly shipped 🚚",
};

export async function notifyOrderPush(store: StoreContext, m: TenantModels, number: number, status: string) {
  if (!store.features["F-109"] || !STATUS_TEXT[status]) return;
  const subs = await m.PushSub.find({ orders: number }).lean();
  if (!subs.length) return;
  const o = await m.Order.findOne({ number }, { trackingToken: 1 }).lean();
  await send(m, subs, { title: store.name, body: `Your order #${number} ${STATUS_TEXT[status]}`, url: `${store.base}/order/${number}${o ? `?t=${o.trackingToken}` : ""}` });
}

export async function broadcastPush(store: StoreContext, m: TenantModels, p: Payload) {
  const subs = await m.PushSub.find({ marketing: true }).lean();
  return send(m, subs, p);
}
