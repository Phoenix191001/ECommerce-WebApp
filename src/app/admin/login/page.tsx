import { redirect } from "next/navigation";
import { platformDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { getAdmin } from "@/lib/auth";
import { AuthForm } from "@/components/admin/forms";
import { AuthShell } from "@/components/admin/auth-shell";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const { SuperAdmin } = platformModels(await platformDb());
  const setup = (await SuperAdmin.estimatedDocumentCount()) === 0;
  return (
    <AuthShell
      title={setup ? "Create the Super Admin" : "Super Admin sign in"}
      subtitle={
        setup
          ? "Welcome! No Super Admin exists yet. The account you create here controls the whole platform. Next you'll set up two-factor sign-in with an authenticator app."
          : "Sign in to manage stores, plans, and feature toggles. You'll confirm with your authenticator app next."
      }
      step={setup ? "Step 1 of 2" : undefined}
    >
      <AuthForm mode={setup ? "setup" : "login"} />
    </AuthShell>
  );
}
