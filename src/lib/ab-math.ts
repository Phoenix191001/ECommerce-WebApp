// F-78 A/B test maths (no server code, so it can be unit tested).

/** Two-proportion z-test: how sure we are that B's conversion rate differs from A's. */
export function significance(va: number, oa: number, vb: number, ob: number) {
  if (va < 1 || vb < 1) return 0;
  const pa = oa / va, pb = ob / vb, p = (oa + ob) / (va + vb);
  const se = Math.sqrt(p * (1 - p) * (1 / va + 1 / vb));
  if (!se) return 0;
  const z = Math.abs(pb - pa) / se;
  // Normal CDF approximation (Abramowitz–Stegun 7.1.26)
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return Math.round(erf * 100);
}
