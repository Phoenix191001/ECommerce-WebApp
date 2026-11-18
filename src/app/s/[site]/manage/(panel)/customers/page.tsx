import { storeModels, formatMoney, requireStore } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Card } from "@/components/admin/ui";

export const metadata = { title: "Customers" };

export default async function Customers({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  await requireStaff(store, "customers");
  const m = await storeModels(store);
  const rows = await m.Order.aggregate<{ _id: string; name: string; phone: string; orders: number; spent: number; last: Date }>([
    { $match: { "customer.email": { $ne: "" }, status: { $nin: ["cancelled"] } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$customer.email", name: { $first: "$customer.name" }, phone: { $first: "$customer.phone" }, orders: { $sum: 1 }, spent: { $sum: "$total" }, last: { $first: "$createdAt" } } },
    { $sort: { spent: -1 } },
    { $limit: 300 },
  ]);
  const accounts = new Set((await m.User.find({ role: "customer" }, { email: 1 }).lean()).map((u) => u.email));
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
      <Card accent="sky">
        {rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Customers appear here after their first order.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Customer</th><th>Phone</th><th>Orders</th><th>Spent</th><th>Last order</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td className="py-2.5"><p className="font-medium">{r.name} {accounts.has(r._id) && <span title="Has an account">👤</span>}</p><p className="text-xs text-slate-500">{r._id}</p></td>
                    <td>{r.phone}</td>
                    <td>{r.orders}</td>
                    <td className="font-medium">{formatMoney(r.spent, store.currency)}</td>
                    <td className="text-slate-600">{new Date(r.last).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
