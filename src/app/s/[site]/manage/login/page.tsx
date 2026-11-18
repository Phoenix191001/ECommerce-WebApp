import { redirect } from "next/navigation";
import { getStore } from "@/lib/tenant";
import { getStoreSession, isStaff } from "@/lib/store-auth";
import { StaffLoginForm } from "@/components/manage/forms";
import { ManageAuthShell } from "@/components/manage/shell";

export const metadata = { title: "Staff sign in" };

export default async function StaffLogin({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const store = (await getStore(site))!;
  if (isStaff((await getStoreSession(store))?.role)) redirect(`${store.base}/manage`);
  return (
    <ManageAuthShell store={store} title="Staff sign in" subtitle="For the store owner, managers, and cashiers. New owner? Use the setup link you were sent.">
      <StaffLoginForm site={site} />
    </ManageAuthShell>
  );
}
