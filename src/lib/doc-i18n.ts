// Text for what customers receive outside the store pages: emails and the printable invoice.
// {name}-style parts are filled in with fill(). Emails use the language the shopper had picked
// when they ordered (or signed up for the alert), otherwise the store's default language.
import { fill } from "./i18n";
import { dirOf, isLang, type LangCode } from "./languages";
import type { StoreContext } from "./tenant";

type Doc = {
  // Emails
  orderReceivedSubject: string; thanks: string; weReceived: string; total: string; payCod: string;
  statusSubject: string; hi: string; statusLine: string;
  st_confirmed: string; st_shipped: string; st_delivered: string; st_cancelled: string; st_refunded: string; st_pending: string;
  partSubject: string; partAll: string; partRest: string;
  returnSubject: string; returnDone: string; rt_refund: string; rt_exchange: string; rt_credit: string;
  ticketSubject: string; chatSubject: string;
  backSubject: string; backBody: string;
  giftSubject: string; giftTitle: string; giftFrom: string; giftHere: string; giftUse: string; giftMessage: string;
  // Invoice
  invoice: string; taxInvoice: string; billTo: string; item: string; qty: string; price: string; amount: string;
  subtotal: string; discount: string; delivery: string; tax: string; giftWrap: string; points: string; credit: string; giftCard: string;
  payment: string; paid: string; dueOnDelivery: string; print: string;
};

const en: Doc = {
  orderReceivedSubject: "{store}: order #{n} received", thanks: "Thank you, {name}!", weReceived: "We received your order #{n}.", total: "Total", payCod: "Payment: cash on delivery.",
  statusSubject: "{store}: order #{n} — {status}", hi: "Hi {name},", statusLine: "Your order #{n}: {status}.",
  st_confirmed: "confirmed", st_shipped: "on the way", st_delivered: "delivered", st_cancelled: "cancelled", st_refunded: "refunded", st_pending: "pending",
  partSubject: "{store}: part of order #{n} is on the way", partAll: "That's everything in your order.", partRest: "The rest of your order will follow.",
  returnSubject: "{store}: your return for order #{n} is complete", returnDone: "Your {type} for order #{n} is complete.", rt_refund: "refund", rt_exchange: "exchange", rt_credit: "store credit",
  ticketSubject: "{store}: reply to “{subject}”", chatSubject: "{store} replied to your chat",
  backSubject: "{store}: {item} is back in stock", backBody: "Good news! {item} is back in stock at {store}.",
  giftSubject: "🎁 Your {store} gift card", giftTitle: "You've got a gift card!", giftFrom: "{from} sent you a {amount} gift card for {store}.", giftHere: "Here is a {amount} gift card for {store}.", giftUse: "Enter this code at checkout.", giftMessage: "Message:",
  invoice: "INVOICE", taxInvoice: "SALES TAX INVOICE", billTo: "Bill to", item: "Item", qty: "Qty", price: "Price", amount: "Amount",
  subtotal: "Subtotal", discount: "Discount", delivery: "Delivery", tax: "Tax", giftWrap: "Gift wrap", points: "Points", credit: "Store credit", giftCard: "Gift card",
  payment: "Payment", paid: "Paid", dueOnDelivery: "Due on delivery", print: "🖨️ Print or save as PDF",
};

const ur: Doc = {
  orderReceivedSubject: "{store}: آرڈر #{n} موصول ہو گیا", thanks: "شکریہ، {name}!", weReceived: "ہمیں آپ کا آرڈر #{n} موصول ہو گیا ہے۔", total: "کل", payCod: "ادائیگی: ڈیلیوری پر نقد۔",
  statusSubject: "{store}: آرڈر #{n} — {status}", hi: "السلام علیکم {name}،", statusLine: "آپ کا آرڈر #{n}: {status}۔",
  st_confirmed: "تصدیق ہو گئی", st_shipped: "راستے میں ہے", st_delivered: "پہنچ گیا", st_cancelled: "منسوخ ہو گیا", st_refunded: "رقم واپس", st_pending: "زیرِ التوا",
  partSubject: "{store}: آرڈر #{n} کا کچھ حصہ راستے میں ہے", partAll: "یہ آپ کے آرڈر کا سارا سامان ہے۔", partRest: "آپ کے آرڈر کا باقی سامان بعد میں آئے گا۔",
  returnSubject: "{store}: آرڈر #{n} کی واپسی مکمل ہو گئی", returnDone: "آرڈر #{n} کے لیے آپ کی {type} مکمل ہو گئی۔", rt_refund: "رقم واپسی", rt_exchange: "تبدیلی", rt_credit: "اسٹور کریڈٹ",
  ticketSubject: "{store}: “{subject}” کا جواب", chatSubject: "{store} نے آپ کی چیٹ کا جواب دیا",
  backSubject: "{store}: {item} دوبارہ دستیاب ہے", backBody: "خوشخبری! {item} اب {store} پر دوبارہ دستیاب ہے۔",
  giftSubject: "🎁 آپ کا {store} گفٹ کارڈ", giftTitle: "آپ کو گفٹ کارڈ ملا ہے!", giftFrom: "{from} نے آپ کو {store} کا {amount} کا گفٹ کارڈ بھیجا ہے۔", giftHere: "یہ رہا {store} کا {amount} کا گفٹ کارڈ۔", giftUse: "چیک آؤٹ پر یہ کوڈ درج کریں۔", giftMessage: "پیغام:",
  invoice: "انوائس", taxInvoice: "سیلز ٹیکس انوائس", billTo: "بل بنام", item: "آئٹم", qty: "تعداد", price: "قیمت", amount: "رقم",
  subtotal: "ذیلی کل", discount: "رعایت", delivery: "ڈیلیوری", tax: "ٹیکس", giftWrap: "گفٹ ریپ", points: "پوائنٹس", credit: "اسٹور کریڈٹ", giftCard: "گفٹ کارڈ",
  payment: "ادائیگی", paid: "ادا شدہ", dueOnDelivery: "ڈیلیوری پر واجب", print: "🖨️ پرنٹ کریں یا PDF محفوظ کریں",
};

const ar: Doc = {
  orderReceivedSubject: "{store}: تم استلام الطلب #{n}", thanks: "شكرًا لك يا {name}!", weReceived: "استلمنا طلبك #{n}.", total: "الإجمالي", payCod: "الدفع: نقدًا عند الاستلام.",
  statusSubject: "{store}: الطلب #{n} — {status}", hi: "مرحبًا {name}،", statusLine: "طلبك #{n}: {status}.",
  st_confirmed: "تم التأكيد", st_shipped: "في الطريق", st_delivered: "تم التوصيل", st_cancelled: "تم الإلغاء", st_refunded: "تم الاسترداد", st_pending: "قيد الانتظار",
  partSubject: "{store}: جزء من الطلب #{n} في الطريق", partAll: "هذا كل ما في طلبك.", partRest: "سيصلك باقي الطلب لاحقًا.",
  returnSubject: "{store}: اكتمل الإرجاع للطلب #{n}", returnDone: "اكتمل {type} للطلب #{n}.", rt_refund: "الاسترداد", rt_exchange: "الاستبدال", rt_credit: "رصيد المتجر",
  ticketSubject: "{store}: رد على “{subject}”", chatSubject: "ردّ {store} على محادثتك",
  backSubject: "{store}: {item} متوفر من جديد", backBody: "خبر سار! {item} متوفر من جديد في {store}.",
  giftSubject: "🎁 بطاقة هدايا {store} الخاصة بك", giftTitle: "وصلتك بطاقة هدايا!", giftFrom: "أرسل لك {from} بطاقة هدايا بقيمة {amount} من {store}.", giftHere: "إليك بطاقة هدايا بقيمة {amount} من {store}.", giftUse: "أدخل هذا الرمز عند الدفع.", giftMessage: "الرسالة:",
  invoice: "فاتورة", taxInvoice: "فاتورة ضريبة المبيعات", billTo: "فاتورة إلى", item: "المنتج", qty: "الكمية", price: "السعر", amount: "المبلغ",
  subtotal: "المجموع الفرعي", discount: "الخصم", delivery: "التوصيل", tax: "الضريبة", giftWrap: "تغليف الهدايا", points: "النقاط", credit: "رصيد المتجر", giftCard: "بطاقة هدايا",
  payment: "الدفع", paid: "مدفوع", dueOnDelivery: "يُدفع عند الاستلام", print: "🖨️ اطبع أو احفظ PDF",
};

const hi: Doc = {
  orderReceivedSubject: "{store}: ऑर्डर #{n} मिल गया", thanks: "धन्यवाद, {name}!", weReceived: "हमें आपका ऑर्डर #{n} मिल गया है।", total: "कुल", payCod: "भुगतान: डिलीवरी पर नकद।",
  statusSubject: "{store}: ऑर्डर #{n} — {status}", hi: "नमस्ते {name},", statusLine: "आपका ऑर्डर #{n}: {status}।",
  st_confirmed: "कन्फ़र्म हो गया", st_shipped: "रास्ते में है", st_delivered: "डिलीवर हो गया", st_cancelled: "रद्द हो गया", st_refunded: "रिफ़ंड हो गया", st_pending: "पेंडिंग",
  partSubject: "{store}: ऑर्डर #{n} का कुछ हिस्सा रास्ते में है", partAll: "यह आपके ऑर्डर का सारा सामान है।", partRest: "आपके ऑर्डर का बाकी सामान बाद में आएगा।",
  returnSubject: "{store}: ऑर्डर #{n} की वापसी पूरी हुई", returnDone: "ऑर्डर #{n} के लिए आपका {type} पूरा हुआ।", rt_refund: "रिफ़ंड", rt_exchange: "बदलाव", rt_credit: "स्टोर क्रेडिट",
  ticketSubject: "{store}: “{subject}” का जवाब", chatSubject: "{store} ने आपकी चैट का जवाब दिया",
  backSubject: "{store}: {item} फिर से स्टॉक में है", backBody: "खुशखबरी! {item} अब {store} पर फिर से उपलब्ध है।",
  giftSubject: "🎁 आपका {store} गिफ़्ट कार्ड", giftTitle: "आपको गिफ़्ट कार्ड मिला है!", giftFrom: "{from} ने आपको {store} का {amount} का गिफ़्ट कार्ड भेजा है।", giftHere: "यह रहा {store} का {amount} का गिफ़्ट कार्ड।", giftUse: "चेकआउट पर यह कोड डालें।", giftMessage: "संदेश:",
  invoice: "इनवॉइस", taxInvoice: "सेल्स टैक्स इनवॉइस", billTo: "बिल प्राप्तकर्ता", item: "आइटम", qty: "मात्रा", price: "कीमत", amount: "राशि",
  subtotal: "उप-योग", discount: "छूट", delivery: "डिलीवरी", tax: "टैक्स", giftWrap: "गिफ़्ट रैप", points: "पॉइंट्स", credit: "स्टोर क्रेडिट", giftCard: "गिफ़्ट कार्ड",
  payment: "भुगतान", paid: "भुगतान हो गया", dueOnDelivery: "डिलीवरी पर देय", print: "🖨️ प्रिंट करें या PDF सहेजें",
};

const pa: Doc = {
  orderReceivedSubject: "{store}: آرڈر #{n} مل گیا", thanks: "شکریہ، {name}!", weReceived: "سانوں تہاڈا آرڈر #{n} مل گیا اے۔", total: "کُل", payCod: "ادائیگی: ڈیلیوری تے نقد۔",
  statusSubject: "{store}: آرڈر #{n} — {status}", hi: "سلام {name}،", statusLine: "تہاڈا آرڈر #{n}: {status}۔",
  st_confirmed: "پکا ہو گیا", st_shipped: "راہ وچ اے", st_delivered: "پہنچ گیا", st_cancelled: "رد ہو گیا", st_refunded: "پیسے واپس", st_pending: "اڈیک وچ",
  partSubject: "{store}: آرڈر #{n} دا کجھ حصہ راہ وچ اے", partAll: "ایہہ تہاڈے آرڈر دا سارا سامان اے۔", partRest: "تہاڈے آرڈر دا باقی سامان بعد وچ آوے گا۔",
  returnSubject: "{store}: آرڈر #{n} دی واپسی مکمل ہو گئی", returnDone: "آرڈر #{n} لئی تہاڈی {type} مکمل ہو گئی۔", rt_refund: "پیسے واپسی", rt_exchange: "وٹاندرا", rt_credit: "دکان کریڈٹ",
  ticketSubject: "{store}: “{subject}” دا جواب", chatSubject: "{store} نے تہاڈی گل بات دا جواب دتا",
  backSubject: "{store}: {item} فیر سٹاک وچ اے", backBody: "چنگی خبر! {item} ہُن {store} تے فیر ملدا اے۔",
  giftSubject: "🎁 تہاڈا {store} گفٹ کارڈ", giftTitle: "تہانوں گفٹ کارڈ ملیا اے!", giftFrom: "{from} نے تہانوں {store} دا {amount} دا گفٹ کارڈ بھیجیا اے۔", giftHere: "ایہہ لوو {store} دا {amount} دا گفٹ کارڈ۔", giftUse: "چیک آؤٹ تے ایہہ کوڈ پاؤ۔", giftMessage: "سنیہا:",
  invoice: "بِل", taxInvoice: "سیلز ٹیکس بِل", billTo: "بِل کس دے ناں", item: "چیز", qty: "گنتی", price: "قیمت", amount: "رقم",
  subtotal: "جوڑ", discount: "رعایت", delivery: "ڈیلیوری", tax: "ٹیکس", giftWrap: "تحفے دی لپیٹ", points: "پوائنٹ", credit: "دکان کریڈٹ", giftCard: "گفٹ کارڈ",
  payment: "ادائیگی", paid: "دے دتا", dueOnDelivery: "ڈیلیوری تے دینا اے", print: "🖨️ پرنٹ کرو یا PDF رکھو",
};

const zh: Doc = {
  orderReceivedSubject: "{store}：已收到订单 #{n}", thanks: "谢谢你，{name}！", weReceived: "我们已收到你的订单 #{n}。", total: "合计", payCod: "付款方式：货到付款。",
  statusSubject: "{store}：订单 #{n} — {status}", hi: "{name}，你好：", statusLine: "你的订单 #{n}：{status}。",
  st_confirmed: "已确认", st_shipped: "运送中", st_delivered: "已送达", st_cancelled: "已取消", st_refunded: "已退款", st_pending: "待处理",
  partSubject: "{store}：订单 #{n} 的部分商品已发出", partAll: "这是你订单的全部商品。", partRest: "其余商品稍后发出。",
  returnSubject: "{store}：订单 #{n} 的退货已完成", returnDone: "订单 #{n} 的{type}已完成。", rt_refund: "退款", rt_exchange: "换货", rt_credit: "店铺余额",
  ticketSubject: "{store}：回复“{subject}”", chatSubject: "{store} 回复了你的聊天",
  backSubject: "{store}：{item} 已到货", backBody: "好消息！{item} 已在 {store} 重新到货。",
  giftSubject: "🎁 你的 {store} 礼品卡", giftTitle: "你收到一张礼品卡！", giftFrom: "{from} 送你一张 {store} 的 {amount} 礼品卡。", giftHere: "这是一张 {store} 的 {amount} 礼品卡。", giftUse: "结账时输入此代码。", giftMessage: "留言：",
  invoice: "发票", taxInvoice: "销售税发票", billTo: "开票给", item: "商品", qty: "数量", price: "单价", amount: "金额",
  subtotal: "小计", discount: "折扣", delivery: "配送", tax: "税费", giftWrap: "礼品包装", points: "积分", credit: "店铺余额", giftCard: "礼品卡",
  payment: "付款", paid: "已付款", dueOnDelivery: "货到付款", print: "🖨️ 打印或保存为 PDF",
};

export const DOCS: Record<LangCode, Doc> = { en, ur, ar, hi, pa, zh };

/** Language for a customer email: the one saved with the order or alert, else the store's default. */
export function docLang(store: StoreContext, saved?: string | null): LangCode {
  if (isLang(saved)) return saved;
  return isLang(store.settings.defaultLang) ? store.settings.defaultLang : "en";
}

export function docs(lang: LangCode) {
  const d = DOCS[lang];
  return { d, f: (k: keyof Doc, vars: Record<string, string | number> = {}) => fill(d[k], vars), dir: dirOf(lang) };
}

/** Wraps email HTML so right-to-left languages read correctly. */
export const emailWrap = (lang: LangCode, html: string) => `<div dir="${docs(lang).dir}">${html}</div>`;
