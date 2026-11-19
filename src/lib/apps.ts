// F-114 app marketplace: add-ons an owner installs from a catalogue and configures.
// Each app either adds a widget/script to the storefront or sends order alerts.

export type AppField = { key: string; label: string; hint?: string; pattern: RegExp; placeholder?: string; secret?: boolean };
export type AppDef = {
  id: string; name: string; icon: string; category: "Chat" | "Analytics" | "Alerts" | "Sales";
  description: string; needs: string; fields: AppField[];
};

export const APPS: AppDef[] = [
  {
    id: "salespop", name: "Recent sales pop-up", icon: "🛎️", category: "Sales",
    description: "Shows small pop-ups like “Someone in Lahore bought Blue Kurta” to build trust. Uses your real recent orders (no names).",
    needs: "Nothing. Works straight away.", fields: [],
  },
  {
    id: "tawk", name: "Tawk.to live chat", icon: "💬", category: "Chat",
    description: "Adds the free Tawk.to chat bubble, with its phone apps for replying on the go.",
    needs: "A free tawk.to account. Copy the Property ID and Widget ID from its Chat Widget settings.",
    fields: [
      { key: "property", label: "Property ID", pattern: /^[a-f0-9]{24}$/, placeholder: "5f1a2b3c4d5e6f7a8b9c0d1e" },
      { key: "widget", label: "Widget ID", pattern: /^[a-z0-9]{6,12}$/, placeholder: "1abc2def3" },
    ],
  },
  {
    id: "gtm", name: "Google Tag Manager", icon: "🏷️", category: "Analytics",
    description: "Load Google Tag Manager to add any tracking tags without code changes.",
    needs: "A Google Tag Manager container.", fields: [{ key: "id", label: "Container ID", pattern: /^GTM-[A-Z0-9]{4,10}$/, placeholder: "GTM-ABC1234" }],
  },
  {
    id: "clarity", name: "Microsoft Clarity", icon: "🔥", category: "Analytics",
    description: "Free heatmaps and session recordings to see how shoppers use your store.",
    needs: "A free Microsoft Clarity project.", fields: [{ key: "id", label: "Project ID", pattern: /^[a-z0-9]{8,12}$/, placeholder: "abcd1234ef" }],
  },
  {
    id: "tiktok", name: "TikTok Pixel", icon: "🎵", category: "Analytics",
    description: "Measure your TikTok ads: page views are sent to TikTok.",
    needs: "A TikTok Ads account pixel.", fields: [{ key: "id", label: "Pixel ID", pattern: /^[A-Z0-9]{15,25}$/, placeholder: "C1A2B3C4D5E6F7G8H9I0" }],
  },
  {
    id: "slack", name: "Slack order alerts", icon: "📨", category: "Alerts",
    description: "Posts a message in a Slack channel for every new online order.",
    needs: "A Slack incoming webhook URL.",
    fields: [{ key: "url", label: "Webhook URL", pattern: /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,120}$/, placeholder: "https://hooks.slack.com/services/…", secret: true }],
  },
  {
    id: "discord", name: "Discord order alerts", icon: "🎮", category: "Alerts",
    description: "Posts a message in a Discord channel for every new online order.",
    needs: "A Discord channel webhook URL.",
    fields: [{ key: "url", label: "Webhook URL", pattern: /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d{5,30}\/[A-Za-z0-9_-]{20,100}$/, placeholder: "https://discord.com/api/webhooks/…", secret: true }],
  },
  {
    id: "telegram", name: "Telegram order alerts", icon: "✈️", category: "Alerts",
    description: "Sends you a Telegram message for every new online order.",
    needs: "A Telegram bot (create one with @BotFather) and your chat ID.",
    fields: [
      { key: "token", label: "Bot token", pattern: /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/, placeholder: "123456789:AA…", secret: true },
      { key: "chat", label: "Chat ID", pattern: /^-?\d{4,20}$/, placeholder: "123456789" },
    ],
  },
];

export const APP_MAP = Object.fromEntries(APPS.map((a) => [a.id, a]));

export type Installed = { id: string; enabled: boolean; config?: Record<string, string> };

/** Enabled apps whose settings are all valid. */
export function activeApps(installed: Installed[] | undefined) {
  return (installed ?? []).filter((x) => x.enabled && APP_MAP[x.id] && APP_MAP[x.id].fields.every((f) => f.pattern.test(x.config?.[f.key] ?? "")));
}
