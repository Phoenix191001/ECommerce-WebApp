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
  createdAt?: Date;
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
  addresses: { label: string; address: string; city: string; phone: string }[];
  createdAt?: Date;
}

export interface LineItem {
  product: Types.ObjectId;
  name: string;
  price: number;
  qty: number;
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
