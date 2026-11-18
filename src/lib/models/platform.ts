import { Schema, type Connection, type Model, type Types } from "mongoose";

export interface Plan {
  name: string;
  description: string;
  priceMonthly: number;
  features: string[];
  maxProducts: number;
  maxStaff: number;
  maxDomains: number;
}

export interface Instance {
  name: string;
  subdomain: string;
  customDomain?: string;
  plan: Types.ObjectId;
  owner: { name: string; email: string };
  status: "active" | "suspended";
  toggles: Map<string, boolean>;
  lockedToggles: string[];
  limitOverrides?: { maxProducts?: number; maxStaff?: number; maxDomains?: number };
  branding?: { primaryColor?: string; logoUrl?: string; tagline?: string };
  currency: string;
  subdomainChangedAt?: Date;
  createdAt?: Date;
}

export interface AuditLog {
  instance?: Types.ObjectId;
  actor: string;
  actorRole: "super_admin" | "store_owner" | "system";
  action: string;
  target?: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt?: Date;
}

export interface SuperAdmin {
  email: string;
  passwordHash: string;
  totpSecret?: string;
}

const planSchema = new Schema<Plan>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    priceMonthly: { type: Number, default: 0, min: 0 },
    // Feature IDs this plan includes (FR-A-02, FR-A-04)
    features: { type: [String], default: [] },
    maxProducts: { type: Number, default: 0 }, // 0 = unlimited
    maxStaff: { type: Number, default: 0 },
    maxDomains: { type: Number, default: 1 },
  },
  { timestamps: true },
);

const instanceSchema = new Schema<Instance>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    customDomain: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    owner: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
    },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    toggles: { type: Map, of: Boolean, default: {} },
    // Toggles locked by the Super Admin (AC-02)
    lockedToggles: { type: [String], default: [] },
    // Per-instance overrides of plan limits (AC-03)
    limitOverrides: {
      maxProducts: Number,
      maxStaff: Number,
      maxDomains: Number,
    },
    branding: {
      primaryColor: { type: String, default: "#111827" },
      logoUrl: String,
      tagline: { type: String, default: "" },
    },
    currency: { type: String, default: "PKR" },
    subdomainChangedAt: Date,
  },
  { timestamps: true },
);

const auditLogSchema = new Schema<AuditLog>(
  {
    instance: { type: Schema.Types.ObjectId, ref: "Instance", index: true },
    actor: { type: String, required: true },
    actorRole: { type: String, enum: ["super_admin", "store_owner", "system"], required: true },
    action: { type: String, required: true },
    target: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const superAdminSchema = new Schema<SuperAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    totpSecret: String, // FR-A-08 (two-factor) — to be enabled
  },
  { timestamps: true },
);


function model<T>(conn: Connection, name: string, schema: Schema<T>): Model<T> {
  return (conn.models[name] as Model<T>) ?? conn.model<T>(name, schema);
}

export function platformModels(conn: Connection) {
  return {
    Plan: model<Plan>(conn, "Plan", planSchema),
    Instance: model<Instance>(conn, "Instance", instanceSchema),
    AuditLog: model<AuditLog>(conn, "AuditLog", auditLogSchema),
    SuperAdmin: model<SuperAdmin>(conn, "SuperAdmin", superAdminSchema),
  };
}
