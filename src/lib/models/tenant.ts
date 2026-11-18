import { Schema, type Connection, type Model } from "mongoose";

export interface Product {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category: string;
  brand: string;
  stock: number;
  status: "draft" | "active";
}

// Per-instance collections. Each lives in the instance's own database, so no
// query can reach another instance's data (NFR-01).

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    images: { type: [String], default: [] },
    category: { type: String, default: "" },
    brand: { type: String, default: "" },
    stock: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "active"], default: "active" },
  },
  { timestamps: true },
);


function model<T>(conn: Connection, name: string, schema: Schema<T>): Model<T> {
  return (conn.models[name] as Model<T>) ?? conn.model<T>(name, schema);
}

export function tenantModels(conn: Connection) {
  return {
    Product: model<Product>(conn, "Product", productSchema),
  };
}
