import { notFound } from "next/navigation";
import { requireStore, storeModels } from "@/lib/tenant";
import { requireStaff } from "@/lib/store-auth";
import { Badge, Card } from "@/components/admin/ui";
import { AnswerForm } from "@/components/manage/catalog-forms";
import { deleteQuestion } from "../../manage-actions";

export const metadata = { title: "Questions" };

export default async function Questions({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = await requireStore(site);
  if (!store.features["F-65"]) notFound();
  await requireStaff(store, "catalog");
  const qs = await (await storeModels(store)).Question.find().sort({ published: 1, createdAt: -1 }).limit(200).lean();
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Product questions</h1>
      <Card accent="violet">
        {qs.length === 0 ? <p className="text-sm text-slate-500">No questions yet. Shoppers ask them on product pages.</p> : (
          <ul className="divide-y divide-slate-100">
            {qs.map((q) => (
              <li key={String(q._id)} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={q.published ? "green" : "amber"}>{q.published ? "answered" : "waiting"}</Badge>
                  <b>{q.productName}</b>
                  <span className="text-slate-500">· {q.name} · {new Date(q.createdAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</span>
                  <form action={deleteQuestion.bind(null, site, String(q._id))} className="ms-auto"><button className="text-xs text-rose-600 hover:underline">Delete</button></form>
                </div>
                <p className="mt-1">“{q.question}”</p>
                <AnswerForm site={site} id={String(q._id)} current={q.answer || undefined} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
