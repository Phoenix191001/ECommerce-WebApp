import type { FeatureGroup } from "../features";

export type FeatureText = { groups: Record<FeatureGroup, string>; rows: Record<string, [name: string, description: string, howTo: string]> };
