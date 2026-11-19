import "server-only";
import { cookies } from "next/headers";
import type { TenantModels } from "./models/tenant";

// F-78 A/B tests. Every visitor gets a stable bucket ("a" or "b") in the `ab` cookie, set by the proxy.

export async function abBucket(): Promise<"a" | "b"> {
  return (await cookies()).get("ab")?.value === "b" ? "b" : "a";
}

/** Text to show for each tested section, and count a view of each running test. */
export async function abVariants(m: TenantModels, countView: boolean) {
  const v = await abBucket();
  const tests = await m.Experiment.find({ active: true }).lean();
  if (countView && tests.length) await m.Experiment.updateMany({ active: true }, { $inc: { [`views.${v}`]: 1 } });
  const pick: Partial<Record<"headline" | "announcement" | "hero", string>> = {};
  for (const t of tests) if (!pick[t.section]) pick[t.section] = (v === "b" ? t.b : t.a) || undefined;
  return pick;
}

export async function recordConversion(m: TenantModels, v: "a" | "b", total: number) {
  await m.Experiment.updateMany({ active: true }, { $inc: { [`orders.${v}`]: 1, [`revenue.${v}`]: total } });
}

export { significance } from "./ab-math";
