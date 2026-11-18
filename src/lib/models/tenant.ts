import { Schema, type Connection, type Model, type Types } from "mongoose";

// Per-instance collections. Each lives in the instance's own database, so no
// query can reach another instance's data (NFR-01).

export type StoreRole = "owner" | "manager" | "cashier" | "customer";

export interface Product {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category: string;
  brand: string;
  sku: string;
  barcode: string;
  stock: number;
  status: "draft" | "active";
  ratingAvg: number;
  ratingCount: number;
  // F-02 variants: when present, price/stock come from the chosen variant
  optionNames: string[];
  variants: Variant[];
  tags: string[]; // F-93
  publishAt?: Date; // F-92
  warrantyMonths: number; // F-111
  sizeGuide: string; // F-64
  volumeTiers: { minQty: number; price: number }[]; // F-62
  salePrice?: number; // F-66
  saleEndsAt?: Date;
  costPrice: number; // F-82 profit reports
  wholesalePrice?: number; // F-61
  createdAt?: Date;
}

export interface Variant {
  _id: Types.ObjectId;
  name: string; // e.g. "Red / M"
  price?: number;
  stock: number;
  sku: string;
  barcode: string;
}

export interface User {
  email: string;
  name: string;
  phone: string;
  passwordHash?: string;
  role: StoreRole;
  refundLimit: number; // cashier refund limit (F-38)
  pinHash?: string; // manager PIN for refund approval (FR-P-03)
  wishlist: Types.ObjectId[];
  setupTokenHash?: string;
  setupTokenExpires?: Date;
  failedLogins: number;
  lockUntil?: Date;
  addresses: { _id?: Types.ObjectId; label: string; address: string; city: string; phone: string }[];
  loyaltyPoints: number; // F-28
  storeCredit: number; // F-56
  creditHistory: { amount: number; reason: string; at: Date }[];
  wholesale: boolean; // F-61
  referralCode?: string; // F-70
  referredBy?: Types.ObjectId;
  referralRewarded: boolean;
  totpSecret?: string; // F-69
  totpEnabled: boolean;
  newsletter: boolean; // F-44
  createdAt?: Date;
}

export interface LineItem {
  product: Types.ObjectId;
  variant?: Types.ObjectId;
  variantName?: string;
  name: string;
  price: number;
  qty: number;
  cost?: number;
}

export interface Cart {
  user?: Types.ObjectId;
  items: LineItem[];
  discountCode?: string;
  updatedAt?: Date;
}

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";

export interface Order {
  number: number;
  channel: "online" | "pos";
  user?: Types.ObjectId;
  cashier?: Types.ObjectId;
  shift?: Types.ObjectId;
  customer: { name: string; email: string; phone: string; address: string; city: string };
  delivery: "shipping" | "pickup";
  items: LineItem[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  shipping: number;
  tax: number;
  total: number;
  paymentMethod: "cod" | "cash" | "card" | "wallet";
  paymentStatus: "unpaid" | "paid" | "refunded" | "partially_refunded";
  status: OrderStatus;
  history: { status: string; at: Date; note?: string; by?: string }[];
  refunds: { amount: number; reason: string; by: string; approvedBy?: string; at: Date }[];
  trackingToken: string;
  note: string;
  giftWrap: boolean; // F-74
  giftMessage: string;
  giftWrapFee: number;
  deliverySlot: string; // F-60
  pointsRedeemed: number; // F-28
  pointsDiscount: number;
  pointsEarned: number;
  creditUsed: number; // F-56
  riskScore: number; // F-106
  riskReasons: string[];
  pendingRefunds: { _id?: Types.ObjectId; amount: number; reason: string; requestedBy: string; at: Date }[]; // F-105
  editedAt?: Date; // F-98
  createdAt?: Date;
}

export interface Discount {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  usageLimit: number; // 0 = unlimited
  used: number;
  active: boolean;
  expiresAt?: Date;
}

export interface Review {
  product: Types.ObjectId;
  user: Types.ObjectId;
  name: string;
  rating: number;
  text: string;
  createdAt?: Date;
}

export interface Shift {
  cashier: Types.ObjectId;
  cashierName: string;
  openedAt: Date;
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  closedAt?: Date;
  countedCash?: number;
}

export interface Outbox {
  to: string;
  subject: string;
  html: string;
  status: "sent" | "logged" | "failed";
  error?: string;
  createdAt?: Date;
}

const lineItem = new Schema<LineItem>(
  {
    product: { type: Schema.Types.ObjectId, required: true },
    variant: Schema.Types.ObjectId,
    variantName: String,
    cost: Number,
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1, max: 999 },
  },
  { _id: false },
);

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    description: { type: String, default: "", maxlength: 5000 },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    images: { type: [String], default: [] },
    category: { type: String, default: "", trim: true, index: true },
    brand: { type: String, default: "", trim: true, index: true },
    sku: { type: String, default: "", trim: true },
    barcode: { type: String, default: "", trim: true, index: true },
    stock: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "active"], default: "active" },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    optionNames: { type: [String], default: [] },
    variants: {
      type: [{ name: { type: String, required: true }, price: Number, stock: { type: Number, default: 0 }, sku: { type: String, default: "" }, barcode: { type: String, default: "" } }],
      default: [],
    },
    tags: { type: [String], default: [], index: true },
    publishAt: Date,
    warrantyMonths: { type: Number, default: 0, min: 0 },
    sizeGuide: { type: String, default: "", maxlength: 5000 },
    volumeTiers: { type: [{ _id: false, minQty: { type: Number, min: 2 }, price: { type: Number, min: 0 } }], default: [] },
    salePrice: { type: Number, min: 0 },
    saleEndsAt: Date,
    costPrice: { type: Number, default: 0, min: 0 },
    wholesalePrice: { type: Number, min: 0 },
  },
  { timestamps: true },
);

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    passwordHash: String,
    role: { type: String, enum: ["owner", "manager", "cashier", "customer"], required: true, index: true },
    refundLimit: { type: Number, default: 0, min: 0 },
    pinHash: String,
    wishlist: { type: [Schema.Types.ObjectId], default: [] },
    setupTokenHash: String,
    setupTokenExpires: Date,
    failedLogins: { type: Number, default: 0 },
    lockUntil: Date,
    addresses: {
      type: [{ label: String, address: String, city: String, phone: String }],
      default: [],
    },
    loyaltyPoints: { type: Number, default: 0 },
    storeCredit: { type: Number, default: 0 },
    creditHistory: { type: [{ _id: false, amount: Number, reason: String, at: Date }], default: [] },
    wholesale: { type: Boolean, default: false },
    referralCode: { type: String, sparse: true, unique: true, uppercase: true },
    referredBy: Schema.Types.ObjectId,
    referralRewarded: { type: Boolean, default: false },
    totpSecret: String,
    totpEnabled: { type: Boolean, default: false },
    newsletter: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const cartSchema = new Schema<Cart>(
  {
    user: { type: Schema.Types.ObjectId, index: true },
    items: { type: [lineItem], default: [] },
    discountCode: String,
  },
  { timestamps: true },
);

const orderSchema = new Schema<Order>(
  {
    number: { type: Number, required: true, unique: true },
    channel: { type: String, enum: ["online", "pos"], default: "online" },
    user: { type: Schema.Types.ObjectId, index: true },
    cashier: Schema.Types.ObjectId,
    shift: Schema.Types.ObjectId,
    customer: {
      name: { type: String, default: "" },
      email: { type: String, default: "", lowercase: true, trim: true },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
    },
    delivery: { type: String, enum: ["shipping", "pickup"], default: "shipping" },
    items: { type: [lineItem], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountCode: String,
    shipping: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cod", "cash", "card", "wallet"], required: true },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded", "partially_refunded"], default: "unpaid" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    history: { type: [{ status: String, at: Date, note: String, by: String }], default: [] },
    refunds: { type: [{ amount: Number, reason: String, by: String, approvedBy: String, at: Date }], default: [] },
    trackingToken: { type: String, required: true },
    note: { type: String, default: "" },
    giftWrap: { type: Boolean, default: false },
    giftMessage: { type: String, default: "" },
    giftWrapFee: { type: Number, default: 0 },
    deliverySlot: { type: String, default: "" },
    pointsRedeemed: { type: Number, default: 0 },
    pointsDiscount: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    creditUsed: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 },
    riskReasons: { type: [String], default: [] },
    pendingRefunds: { type: [{ amount: Number, reason: String, requestedBy: String, at: Date }], default: [] },
    editedAt: Date,
  },
  { timestamps: true },
);

const discountSchema = new Schema<Discount>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: 0, min: 0 },
    used: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    expiresAt: Date,
  },
  { timestamps: true },
);

const reviewSchema = new Schema<Review>(
  {
    product: { type: Schema.Types.ObjectId, required: true, index: true },
    user: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true },
);
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

const shiftSchema = new Schema<Shift>(
  {
    cashier: { type: Schema.Types.ObjectId, required: true, index: true },
    cashierName: { type: String, required: true },
    openedAt: { type: Date, required: true },
    openingCash: { type: Number, required: true, min: 0 },
    cashSales: { type: Number, default: 0 },
    cashRefunds: { type: Number, default: 0 },
    closedAt: Date,
    countedCash: Number,
  },
  { timestamps: true },
);

const outboxSchema = new Schema<Outbox>(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    status: { type: String, enum: ["sent", "logged", "failed"], required: true },
    error: String,
  },
  { timestamps: true },
);

export interface ReturnRequest {
  orderNumber: number;
  user: Types.ObjectId;
  customerName: string;
  items: { product: Types.ObjectId; variant?: Types.ObjectId; name: string; qty: number; price: number }[];
  type: "refund" | "exchange" | "credit"; // F-46, F-100
  reason: string;
  status: "requested" | "approved" | "rejected" | "completed";
  note: string;
  createdAt?: Date;
}

export interface Ticket {
  user: Types.ObjectId;
  customerName: string;
  email: string;
  subject: string;
  orderNumber?: number;
  status: "open" | "closed";
  messages: { from: "customer" | "staff"; name: string; text: string; at: Date }[];
  updatedAt?: Date;
  createdAt?: Date;
}

export interface Question {
  product: Types.ObjectId;
  productName: string;
  name: string;
  question: string;
  answer: string;
  answeredBy: string;
  published: boolean;
  createdAt?: Date;
}

export interface StockAlert {
  product: Types.ObjectId;
  variant?: Types.ObjectId;
  email: string;
  notified: boolean;
  createdAt?: Date;
}

export interface Subscriber {
  email: string;
  createdAt?: Date;
}

export interface Page {
  kind: "page" | "post";
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  published: boolean;
  createdAt?: Date;
}

export interface Expense {
  date: Date;
  category: string;
  amount: number;
  note: string;
}

export interface Attendance {
  staff: Types.ObjectId;
  name: string;
  clockIn: Date;
  clockOut?: Date;
}

export interface ApiKey {
  name: string;
  prefix: string;
  hash: string;
  lastUsedAt?: Date;
  createdAt?: Date;
}

export interface Webhook {
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  lastStatus?: string;
  lastAt?: Date;
}

const returnSchema = new Schema<ReturnRequest>(
  {
    orderNumber: { type: Number, required: true, index: true },
    user: { type: Schema.Types.ObjectId, required: true, index: true },
    customerName: { type: String, default: "" },
    items: { type: [{ _id: false, product: Schema.Types.ObjectId, variant: Schema.Types.ObjectId, name: String, qty: Number, price: Number }], default: [] },
    type: { type: String, enum: ["refund", "exchange", "credit"], required: true },
    reason: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["requested", "approved", "rejected", "completed"], default: "requested", index: true },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

const ticketSchema = new Schema<Ticket>(
  {
    user: { type: Schema.Types.ObjectId, required: true, index: true },
    customerName: String,
    email: String,
    subject: { type: String, required: true, maxlength: 200 },
    orderNumber: Number,
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    messages: { type: [{ _id: false, from: String, name: String, text: { type: String, maxlength: 4000 }, at: Date }], default: [] },
  },
  { timestamps: true },
);

const questionSchema = new Schema<Question>(
  {
    product: { type: Schema.Types.ObjectId, required: true, index: true },
    productName: String,
    name: { type: String, required: true, maxlength: 80 },
    question: { type: String, required: true, maxlength: 1000 },
    answer: { type: String, default: "" },
    answeredBy: { type: String, default: "" },
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const stockAlertSchema = new Schema<StockAlert>(
  {
    product: { type: Schema.Types.ObjectId, required: true, index: true },
    variant: Schema.Types.ObjectId,
    email: { type: String, required: true, lowercase: true, trim: true },
    notified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const subscriberSchema = new Schema<Subscriber>(
  { email: { type: String, required: true, unique: true, lowercase: true, trim: true } },
  { timestamps: true },
);

const pageSchema = new Schema<Page>(
  {
    kind: { type: String, enum: ["page", "post"], required: true },
    title: { type: String, required: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    body: { type: String, default: "", maxlength: 50000 },
    excerpt: { type: String, default: "", maxlength: 300 },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const expenseSchema = new Schema<Expense>(
  {
    date: { type: Date, required: true, index: true },
    category: { type: String, default: "Other" },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

const attendanceSchema = new Schema<Attendance>(
  {
    staff: { type: Schema.Types.ObjectId, required: true, index: true },
    name: String,
    clockIn: { type: Date, required: true },
    clockOut: Date,
  },
  { timestamps: true },
);

const apiKeySchema = new Schema<ApiKey>(
  {
    name: { type: String, required: true },
    prefix: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    lastUsedAt: Date,
  },
  { timestamps: true },
);

const webhookSchema = new Schema<Webhook>(
  {
    url: { type: String, required: true },
    events: { type: [String], default: [] },
    secret: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastStatus: String,
    lastAt: Date,
  },
  { timestamps: true },
);

const counterSchema = new Schema<{ _id: string; seq: number }>({ _id: String, seq: Number });

function model<T>(conn: Connection, name: string, schema: Schema<T>): Model<T> {
  return (conn.models[name] as Model<T>) ?? conn.model<T>(name, schema);
}

export function tenantModels(conn: Connection) {
  return {
    Product: model<Product>(conn, "Product", productSchema),
    User: model<User>(conn, "User", userSchema),
    Cart: model<Cart>(conn, "Cart", cartSchema),
    Order: model<Order>(conn, "Order", orderSchema),
    Discount: model<Discount>(conn, "Discount", discountSchema),
    Review: model<Review>(conn, "Review", reviewSchema),
    Shift: model<Shift>(conn, "Shift", shiftSchema),
    Outbox: model<Outbox>(conn, "Outbox", outboxSchema),
    Counter: model<{ _id: string; seq: number }>(conn, "Counter", counterSchema),
    Return: model<ReturnRequest>(conn, "Return", returnSchema),
    Ticket: model<Ticket>(conn, "Ticket", ticketSchema),
    Question: model<Question>(conn, "Question", questionSchema),
    StockAlert: model<StockAlert>(conn, "StockAlert", stockAlertSchema),
    Subscriber: model<Subscriber>(conn, "Subscriber", subscriberSchema),
    Page: model<Page>(conn, "Page", pageSchema),
    Expense: model<Expense>(conn, "Expense", expenseSchema),
    Attendance: model<Attendance>(conn, "Attendance", attendanceSchema),
    ApiKey: model<ApiKey>(conn, "ApiKey", apiKeySchema),
    Webhook: model<Webhook>(conn, "Webhook", webhookSchema),
  };
}

export type TenantModels = ReturnType<typeof tenantModels>;

export async function nextOrderNumber(m: TenantModels): Promise<number> {
  const c = await m.Counter.findOneAndUpdate(
    { _id: "order" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return 1000 + (c?.seq ?? 1);
}

/** Build every per-instance collection's indexes (unique slugs, emails, order numbers). Run on provisioning. */
export async function ensureTenantIndexes(m: TenantModels) {
  await Promise.all(Object.values(m).map((model) => model.createIndexes()));
}
