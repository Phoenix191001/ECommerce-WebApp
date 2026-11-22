import "server-only";
import { cookies } from "next/headers";
import type { StoreContext } from "./tenant";
import { translate } from "./tr-match";
import { dirOf, isLang, type LangCode } from "./languages";
import { ar, hi, pa, zh } from "./panel-locales";
import { ur as urTr } from "./panel-tr/ur";
import { ar as arTr } from "./panel-tr/ar";
import { hi as hiTr } from "./panel-tr/hi";
import { pa as paTr } from "./panel-tr/pa";
import { zh as zhTr } from "./panel-tr/zh";
import { urMsg } from "./panel-tr/msg-ur";
import { arMsg } from "./panel-tr/msg-ar";
import { hiMsg } from "./panel-tr/msg-hi";
import { paMsg } from "./panel-tr/msg-pa";
import { zhMsg } from "./panel-tr/msg-zh";

// Store panel text in six languages (keyed here for the menu, dashboard and lists; full sentences in panel-tr/). The staff member picks the language for themselves
// (cookie plang_<storeId>); it is separate from the language shoppers choose on the storefront.

const en = {
  giftCards: "Gift cards", affiliates: "Affiliates", abTests: "A/B tests", notifications: "Push", warehouses: "Warehouses",
  purchaseOrders: "Purchase orders", sellers: "Sellers", liveChat: "Live chat", apps: "App store", mySales: "My sales", role_seller: "Seller",
  home: "Home", orders: "Orders", products: "Products", customers: "Customers", returns: "Returns", support: "Support",
  discounts: "Discounts", pos: "POS", staff: "Staff", profit: "Profit", content: "Content", features: "Features",
  settings: "Settings", activity: "Activity", developers: "Developers", viewStore: "View store ↗", help: "Help & guide ↗",
  plan: "{plan} plan", hi: "Hi, {name} 👋", signOut: "Sign out", switchLang: "اردو",
  role_owner: "Owner", role_manager: "Manager", role_cashier: "Cashier",
  impersonating: "👀 You're signed in as the store owner from the platform admin ({who}). Everything you do here is recorded.",
  suspended: "⏸️ This store is suspended by the platform. Customers see a maintenance page.",
  dashboard: "Dashboard", last30: "Last 30 days at {store}.", newOrders: "🔔 {n} new order(s) to confirm",
  setUp: "🚀 Set up your store", hide: "Hide", fiveSteps: "Five quick steps to your first sale. Most stores finish in under 30 minutes.",
  stepBrand: "Set your store name, color, and logo", stepProduct: "Add your first product",
  stepShipping: "Set delivery fees, tax, and contact details", stepFeatures: "Choose your features",
  stepLaunch: "Open your store and place a test order", openWizard: "Open the setup wizard →",
  revenue: "Revenue", avgOrder: "Average order", sales14: "Sales, last 14 days",
  turnOnAnalytics: "Turn on the Analytics dashboard (F-49) in Features to see sales charts here.",
  recentOrders: "🧾 Recent orders", allOrders: "All orders →", noOrdersYet: "No orders yet. Share your store link to get your first sale!",
  walkIn: "Walk-in", topProducts: "🏆 Top products", salesShowHere: "Sales will show here.", sold: "{n} sold",
  lowStock: "⚠️ Low stock", wellStocked: "Everything is well stocked.", out: "Out", left: "{n} left",
  all: "All",
  st_pending: "New", st_confirmed: "Confirmed", st_shipped: "Shipped", st_delivered: "Delivered", st_cancelled: "Cancelled", st_refunded: "Refunded",
  exportCsv: "⬇️ Export CSV", searchOrders: "Order number, email, or phone…", noOrdersHere: "No orders here yet.",
  colOrder: "Order", colDate: "Date", colCustomer: "Customer", colChannel: "Channel", colPayment: "Payment", colStatus: "Status", colTotal: "Total",
  online: "Online", bulk: "📑 Bulk edit / import", questions: "❓ Questions", addProduct: "➕ Add product", productSaved: "✅ Product saved.",
  searchProducts: "Search by name, SKU, or barcode…", noProducts: "No products yet.", addFirst: "Add your first product",
  colProduct: "Product", colPrice: "Price", colStock: "Stock", colCategory: "Category", variants: "({n} variants)", scheduled: "⏰ scheduled",
  ps_active: "active", ps_draft: "draft", ps_archived: "archived",
  pay_unpaid: "unpaid", pay_paid: "paid", pay_refunded: "refunded", pay_partially_refunded: "partly refunded",
};

export type PanelDict = typeof en;

const ur: PanelDict = {
  giftCards: "گفٹ کارڈ", affiliates: "ایفیلیٹس", abTests: "اے/بی ٹیسٹ", notifications: "پش اطلاعات", warehouses: "گودام",
  purchaseOrders: "خریداری آرڈر", sellers: "فروخت کنندگان", liveChat: "لائیو چیٹ", apps: "ایپ اسٹور", mySales: "میری فروخت", role_seller: "فروخت کنندہ",
  home: "ہوم", orders: "آرڈرز", products: "پروڈکٹس", customers: "گاہک", returns: "واپسیاں", support: "سپورٹ",
  discounts: "ڈسکاؤنٹس", pos: "کاؤنٹر (POS)", staff: "عملہ", profit: "منافع", content: "مواد", features: "فیچرز",
  settings: "سیٹنگز", activity: "سرگرمی", developers: "ڈویلپرز", viewStore: "اسٹور دیکھیں ↗", help: "مدد اور رہنمائی ↗",
  plan: "{plan} پلان", hi: "السلام علیکم، {name} 👋", signOut: "سائن آؤٹ", switchLang: "English",
  role_owner: "مالک", role_manager: "مینیجر", role_cashier: "کیشیئر",
  impersonating: "👀 آپ پلیٹ فارم ایڈمن ({who}) کی طرف سے اسٹور مالک کے طور پر سائن ان ہیں۔ یہاں ہر کام ریکارڈ ہوتا ہے۔",
  suspended: "⏸️ پلیٹ فارم نے یہ اسٹور معطل کر دیا ہے۔ گاہکوں کو مرمت کا صفحہ نظر آتا ہے۔",
  dashboard: "ڈیش بورڈ", last30: "{store} کے پچھلے 30 دن۔", newOrders: "🔔 تصدیق کے لیے {n} نئے آرڈر",
  setUp: "🚀 اپنا اسٹور تیار کریں", hide: "چھپائیں", fiveSteps: "پہلی فروخت تک پانچ آسان قدم۔ زیادہ تر اسٹور 30 منٹ سے کم میں مکمل کر لیتے ہیں۔",
  stepBrand: "اسٹور کا نام، رنگ اور لوگو لگائیں", stepProduct: "اپنی پہلی پروڈکٹ شامل کریں",
  stepShipping: "ڈیلیوری فیس، ٹیکس اور رابطے کی تفصیلات لکھیں", stepFeatures: "اپنے فیچرز چنیں",
  stepLaunch: "اسٹور کھولیں اور ایک آزمائشی آرڈر دیں", openWizard: "سیٹ اپ گائیڈ کھولیں ←",
  revenue: "آمدنی", avgOrder: "اوسط آرڈر", sales14: "فروخت، پچھلے 14 دن",
  turnOnAnalytics: "یہاں فروخت کے چارٹ دیکھنے کے لیے فیچرز میں اینالیٹکس ڈیش بورڈ (F-49) آن کریں۔",
  recentOrders: "🧾 حالیہ آرڈرز", allOrders: "تمام آرڈرز ←", noOrdersYet: "ابھی کوئی آرڈر نہیں۔ پہلی فروخت کے لیے اپنے اسٹور کا لنک شیئر کریں!",
  walkIn: "دکان پر", topProducts: "🏆 سب سے زیادہ بکنے والی", salesShowHere: "فروخت یہاں نظر آئے گی۔", sold: "{n} فروخت",
  lowStock: "⚠️ کم اسٹاک", wellStocked: "سب کچھ اسٹاک میں ہے۔", out: "ختم", left: "{n} باقی",
  all: "سب",
  st_pending: "نیا", st_confirmed: "تصدیق شدہ", st_shipped: "روانہ", st_delivered: "پہنچ گیا", st_cancelled: "منسوخ", st_refunded: "رقم واپس",
  exportCsv: "⬇️ CSV ڈاؤن لوڈ", searchOrders: "آرڈر نمبر، ای میل یا فون…", noOrdersHere: "یہاں ابھی کوئی آرڈر نہیں۔",
  colOrder: "آرڈر", colDate: "تاریخ", colCustomer: "گاہک", colChannel: "ذریعہ", colPayment: "ادائیگی", colStatus: "حالت", colTotal: "کل",
  online: "آن لائن", bulk: "📑 اکٹھے ترمیم / امپورٹ", questions: "❓ سوالات", addProduct: "➕ پروڈکٹ شامل کریں", productSaved: "✅ پروڈکٹ محفوظ ہو گئی۔",
  searchProducts: "نام، SKU یا بارکوڈ سے تلاش کریں…", noProducts: "ابھی کوئی پروڈکٹ نہیں۔", addFirst: "اپنی پہلی پروڈکٹ شامل کریں",
  colProduct: "پروڈکٹ", colPrice: "قیمت", colStock: "اسٹاک", colCategory: "کیٹیگری", variants: "({n} اقسام)", scheduled: "⏰ شیڈول شدہ",
  ps_active: "فعال", ps_draft: "ڈرافٹ", ps_archived: "محفوظ شدہ",
  pay_unpaid: "ادا نہیں ہوا", pay_paid: "ادا شدہ", pay_refunded: "رقم واپس", pay_partially_refunded: "جزوی واپسی",
};

const DICTS: Record<LangCode, PanelDict> = { en, ur, ar, hi, pa, zh };
/** Full-sentence translations for the rest of the panel, keyed by the English text. */
const TR: Partial<Record<LangCode, Record<string, string>>> = {
  ur: { ...urTr, ...urMsg }, ar: { ...arTr, ...arMsg }, hi: { ...hiTr, ...hiMsg }, pa: { ...paTr, ...paMsg }, zh: { ...zhTr, ...zhMsg },
};

export async function panelPrefs(store: StoreContext): Promise<{ lang: LangCode; p: PanelDict; dir: "ltr" | "rtl"; t: (s: string) => string; tr: Record<string, string> }> {
  const v = (await cookies()).get(`plang_${store.id}`)?.value;
  const lang: LangCode = isLang(v) ? v : "en";
  const tr = TR[lang] ?? {};
  return { lang, p: DICTS[lang], dir: dirOf(lang), t: (s: string) => translate(tr, s), tr };
}

export const pStatus = (p: PanelDict, s: string) => (p as Record<string, string>)[`st_${s}`] ?? s;
export const pText = (p: PanelDict, prefix: string, s: string) => (p as Record<string, string>)[`${prefix}_${s}`] ?? s.replace(/_/g, " ");
