"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { platformDb, instanceDb } from "@/lib/db";
import { platformModels } from "@/lib/models/platform";
import { tenantModels } from "@/lib/models/tenant";
import { provisionInstance } from "@/lib/provision";
import { createStoreSession } from "@/lib/store-auth";
import { getStore } from "@/lib/tenant";

export type StartState = { error?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Enter your store's name.").max(80),
  subdomain: z.string(),
  planId: z.string().refine((v) => Types.ObjectId.isValid(v), "Choose a plan."),
  ownerName: z.string().trim().min(2, "Enter your name."),
  ownerEmail: z.email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for your password."),
  website: z.string().max(0).optional(), // honeypot: bots fill it, people don't see it
});

/** FR-S-01 / FR-S-02: choose a plan and get a working store in one step. */
export async function startStore(_: StartState, form: FormData): Promise<StartState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const { Plan } = platformModels(await platformDb());
  const plan = await Plan.findById(d.planId).lean();
  if (!plan) return { error: "That plan no longer exists." };
  if (plan.requiresActivation || plan.priceMonthly > 0)
    return { error: `${plan.name} is activated by our team. Use “Contact us to activate” on the ${plan.name} card, or choose another plan.` };
  const res = await provisionInstance(d, { email: d.ownerEmail, role: "system" });
  if ("error" in res) return { error: res.error };
  const m = tenantModels(await instanceDb(res.id));
  const owner = await m.User.findOne({ role: "owner" });
  owner!.passwordHash = await bcrypt.hash(d.password, 12);
  await owner!.save();
  const store = await getStore(res.subdomain);
  await createStoreSession(store!, String(owner!._id), "owner");
  redirect(`/s/${res.subdomain}/manage/welcome`);
}
