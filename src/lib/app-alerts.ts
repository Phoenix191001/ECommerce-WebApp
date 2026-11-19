import "server-only";
import type { StoreContext } from "./tenant";
import { formatMoney } from "./tenant";
import { activeApps } from "./apps";

/** F-114: tell the owner's chat apps about a new order. Never blocks or fails the order. */
export async function alertApps(store: StoreContext, o: { number: number; total: number; customer: { name: string; city: string }; items: { name: string; qty: number }[] }) {
  if (!store.features["F-114"]) return;
  const text = `🛒 ${store.name}: new order #${o.number} · ${formatMoney(o.total, store.currency)} · ${o.customer.name}${o.customer.city ? `, ${o.customer.city}` : ""}\n${o.items.map((i) => `• ${i.name} × ${i.qty}`).join("\n")}`;
  const send = (url: string, body: unknown) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) }).catch(() => {});
  await Promise.all(
    activeApps(store.settings.apps).map(({ id, config = {} }) => {
      const a = { id, config };
      if (a.id === "slack") return send(a.config.url, { text });
      if (a.id === "discord") return send(a.config.url, { content: text.slice(0, 1900) });
      if (a.id === "telegram") return send(`https://api.telegram.org/bot${a.config.token}/sendMessage`, { chat_id: a.config.chat, text });
      return null;
    }),
  );
}
