// Feature names, descriptions and how-tos in each language, with English as the fallback.
import { DESCRIPTIONS, FEATURE_MAP, GROUP_LABELS, type FeatureGroup } from "../features";
import { HOW_TO } from "../feature-help";
import type { LangCode } from "../languages";
import type { FeatureText } from "./types";
import { ur } from "./ur";
import { ar } from "./ar";
import { hi } from "./hi";
import { pa } from "./pa";
import { zh } from "./zh";

export const FEATURE_TEXT: Partial<Record<LangCode, FeatureText>> = { ur, ar, hi, pa, zh };

export function featureText(lang: LangCode) {
  const t = FEATURE_TEXT[lang];
  return {
    name: (id: string) => t?.rows[id]?.[0] ?? FEATURE_MAP[id]?.name ?? id,
    desc: (id: string) => t?.rows[id]?.[1] ?? DESCRIPTIONS[id] ?? "",
    how: (id: string) => t?.rows[id]?.[2] ?? HOW_TO[id] ?? "",
    group: (g: FeatureGroup) => t?.groups[g] ?? GROUP_LABELS[g],
  };
}
