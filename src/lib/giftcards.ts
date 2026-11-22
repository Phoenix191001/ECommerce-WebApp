import "server-only";
import type { TenantModels } from "./models/tenant";
import type { StoreContext } from "./tenant";
import { docLang, docs, emailWrap } from "./doc-i18n";
import { esc, sendEmail } from "./email";
import { formatMoney } from "./tenant";

// F-32 gift cards: a code with a balance. Spent at checkout; bought online or issued by staff.

import { newGiftCode, normCode } from "./giftcode";
export { newGiftCode, normCode };

export async function checkGiftCard(m: TenantModels, raw: string): Promise<{ error?: string; code?: string; balance?: number }> {
  const code = normCode(raw);
  const g = await m.GiftCard.findOne({ code }).lean();
  if (!g || !g.active) return { error: "That gift card code isn't valid." };
  if (g.expiresAt && g.expiresAt < new Date()) return { error: "That gift card has expired." };
  if (g.balance <= 0) return { error: "That gift card has no balance left." };
  return { code, balance: g.balance };
}

/** Take `amount` off a card only if it still has that much (atomic). */
export async function redeemGiftCard(m: TenantModels, code: string, amount: number, by: string, orderNumber?: number) {
  const r = await m.GiftCard.updateOne(
    { code, active: true, balance: { $gte: amount } },
    { $inc: { balance: -amount }, $push: { history: { amount: -amount, orderNumber, by, at: new Date() } } },
  );
  return r.modifiedCount === 1;
}

/** Give back what an order took from a gift card (cancellation). */
export async function refundGiftCard(m: TenantModels, code: string, amount: number, orderNumber: number) {
  if (amount <= 0) return;
  await m.GiftCard.updateOne({ code }, { $inc: { balance: amount }, $push: { history: { amount, orderNumber, by: "cancelled order", at: new Date() } } });
}

export async function issueGiftCard(
  store: StoreContext, m: TenantModels,
  opts: { amount: number; recipient?: string; note?: string; orderNumber?: number; by: string; expiresAt?: Date; from?: string; lang?: string },
) {
  let code = newGiftCode();
  for (let i = 0; i < 3 && (await m.GiftCard.exists({ code })); i++) code = newGiftCode();
  await m.GiftCard.create({
    code, initial: opts.amount, balance: opts.amount, recipient: opts.recipient ?? "", note: opts.note ?? "",
    orderNumber: opts.orderNumber, expiresAt: opts.expiresAt, history: [{ amount: opts.amount, orderNumber: opts.orderNumber, by: opts.by, at: new Date() }],
  });
  if (opts.recipient && store.features["F-41"]) {
    const lang = docLang(store, opts.lang);
    const { f: L } = docs(lang);
    const amount = `<b>${formatMoney(opts.amount, store.currency)}</b>`;
    await sendEmail(
      m, opts.recipient, L("giftSubject", { store: store.name }),
      emailWrap(lang, `<h2>${L("giftTitle")}</h2><p>${opts.from ? L("giftFrom", { from: esc(opts.from), amount, store: esc(store.name) }) : L("giftHere", { amount, store: esc(store.name) })}</p>` +
        `<p dir="ltr" style="font-size:22px;font-family:monospace;letter-spacing:2px"><b>${code}</b></p><p>${L("giftUse")}${opts.note ? `<br>${L("giftMessage")} ${esc(opts.note)}` : ""}</p>`),
    );
  }
  return code;
}

/** Issue the gift cards an order bought, once (called when the order is confirmed). */
export async function issueOrderGiftCards(store: StoreContext, m: TenantModels, number: number) {
  const o = await m.Order.findOne({ number });
  if (!o || o.giftCardsIssued.length || !store.features["F-32"]) return;
  const codes: string[] = [];
  for (const it of o.items.filter((i) => i.kind === "giftcard")) {
    const recipient = it.custom?.find((c) => /email/i.test(c.label))?.value || o.customer.email;
    const note = it.custom?.find((c) => /message/i.test(c.label))?.value ?? "";
    for (let q = 0; q < it.qty; q++)
      codes.push(await issueGiftCard(store, m, { amount: it.price, recipient, note, orderNumber: number, by: `order #${number}`, from: o.customer.name, lang: o.lang }));
  }
  if (codes.length) await m.Order.updateOne({ number }, { $set: { giftCardsIssued: codes } });
}
