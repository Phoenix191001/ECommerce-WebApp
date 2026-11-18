import { Types } from "mongoose";
import { getAdmin } from "@/lib/auth";
import { platformDb, instanceDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";

// AC-06 / FR-A-09: export everything an instance holds.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return new Response("Not found", { status: 404 });
  const { Instance, AuditLog } = platformModels(await platformDb());
  const inst = await Instance.findById(id).lean();
  if (!inst) return new Response("Not found", { status: 404 });

  const db = (await instanceDb(id)).db!;
  const collections = await db.listCollections().toArray();
  const data: Record<string, unknown[]> = {};
  for (const c of collections) {
    data[c.name] = await db
      .collection(c.name)
      .find({}, { projection: { passwordHash: 0, pinHash: 0, setupTokenHash: 0 } })
      .toArray();
  }
  await Instance.updateOne({ _id: inst._id }, { $set: { exportedAt: new Date() } });
  await AuditLog.create({ instance: inst._id, actor: admin.email, actorRole: "super_admin", action: "instance.export" });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), instance: inst, data }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${inst.subdomain}-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
