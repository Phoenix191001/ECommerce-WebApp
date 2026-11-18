import { redirect } from "next/navigation";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { getAdmin } from "@/lib/auth";
import { AuthForm } from "@/components/admin/forms";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const { SuperAdmin } = platformModels(await platformDb());
  const setup = (await SuperAdmin.estimatedDocumentCount()) === 0;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">{setup ? "Create the Super Admin" : "Super Admin sign in"}</h1>
        <p className="mb-5 mt-1 text-sm text-gray-500">
          {setup
            ? "No Super Admin exists yet. The first account created here controls the whole platform."
            : "Sign in to manage instances, plans, and feature toggles."}
        </p>
        <AuthForm mode={setup ? "setup" : "login"} />
      </div>
    </main>
  );
}
