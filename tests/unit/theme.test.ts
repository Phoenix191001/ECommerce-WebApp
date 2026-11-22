import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, cleanTheme, fontHref, themeVars, contrastText } from "../../src/lib/theme";

test("every ready-made theme is valid and survives cleaning unchanged", () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    const t = cleanTheme({ ...p.theme, preset: id });
    assert.deepEqual({ ...t, preset: undefined }, { ...p.theme, preset: undefined }, id);
  }
});

test("bad design values fall back to safe defaults", () => {
  const t = cleanTheme({ bg: "red; background:url(x)", font: "comic", radius: "huge", grid: 9, heroImage: 'javascript:alert(1)', bgImage: 'https://x.com/a.png") ; x', heroTitle: "x".repeat(500) });
  assert.equal(t.bg, "#f8fafc");
  assert.equal(t.font, "system");
  assert.equal(t.radius, "large");
  assert.equal(t.grid, 4);
  assert.equal(t.heroImage, "");
  assert.equal(t.bgImage, "");
  assert.equal(t.heroTitle.length, 80);
});

test("theme turns into CSS variables and font links", () => {
  const t = cleanTheme({ ...PRESETS.boutique.theme });
  assert.equal(themeVars(t)["--st-button"], PRESETS.boutique.theme.button);
  assert.match(fontHref(t), /Lora.*Playfair|Playfair.*Lora/);
  assert.equal(fontHref(cleanTheme({})), "");
  assert.equal(contrastText("#ffffff"), "#000000");
  assert.equal(contrastText("#000000"), "#ffffff");
});
