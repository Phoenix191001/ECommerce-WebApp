// End-to-end check of the Design page (F-15): themes, colours, banner, and the storefront using them.
// Usage: node tests/e2e/section4.cjs <baseUrl> <vercelShareToken>
// Needs the Super Admin created by e2e.cjs (E2E_CREDS file). Creates one store and deletes it at the end.
const { chromium } = require("playwright");

// Feature groups are dropdowns: open the one holding a switch before clicking it.
async function opened(p, id) {
  const sw = p.locator(`button[role=switch][aria-label^="${id} "]`);
  const closed = p.locator("details:not([open])", { has: sw });
  if (await closed.count()) await closed.locator(":scope > summary").click();
  return sw;
}
const { TOTP, Secret } = require("otpauth");
const fs = require("fs");

const BASE = process.argv[2];
const SHARE = process.argv[3];
const SHOTS = process.env.E2E_SHOTS || __dirname + "/shots";
const CREDS = process.env.E2E_CREDS || __dirname + "/e2e-admin.json";
fs.mkdirSync(SHOTS, { recursive: true });
const ADMIN = JSON.parse(fs.readFileSync(CREDS, "utf8"));
const rnd = Math.random().toString(36).slice(2, 7);
let SUB = `dz-${rnd}`;
const OWNER = { email: `owner-${rnd}@example.test`, password: "OwnerPass!2345" };
const SHOPPER = { name: "Hina Shopper", email: `hina-${rnd}@example.test`, password: "ShopperPass1" };
const results = [];
const PAGES = [];

async function step(name, fn) {
  try { await fn(); results.push(["PASS", name]); console.log("PASS", name); }
  catch (e) {
    results.push(["FAIL", name]); console.log("FAIL", name, String(e).slice(0, 500));
    for (const [i, pg] of PAGES.entries()) {
      try {
        await pg.screenshot({ path: `${SHOTS}/DZ-FAIL-${i}.png` });
        const alerts = await pg.locator("[role=alert]:not(#__next-route-announcer__)").allTextContents();
        console.log(`  page ${i} url=${pg.url()} alerts=${JSON.stringify(alerts)}`);
      } catch {}
    }
    throw e;
  }
}
const see = (p, t) => p.getByText(t).first().waitFor();

(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const newPage = async (opts = {}) => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    const p = await c.newPage();
    p.setDefaultTimeout(30000);
    PAGES.push(p);
    await p.goto(`${BASE}/?_vercel_share=${SHARE}`);
    return p;
  };
  const admin = await newPage();
  let storeId = "";
  let S = "";
  try {
    await step("admin signs in with 2FA", async () => {
      await admin.goto(`${BASE}/admin/login`);
      await admin.getByLabel("Email").fill(ADMIN.email);
      await admin.getByLabel("Password").fill(ADMIN.password);
      await admin.getByRole("button", { name: "Continue" }).click();
      await see(admin, "Two-factor check");
      await admin.waitForTimeout(31000);
      await admin.getByLabel("6-digit code").fill(new TOTP({ secret: Secret.fromBase32(ADMIN.secret) }).generate());
      await admin.getByRole("button", { name: "Verify and sign in" }).click();
      await see(admin, "Welcome back");
    });

    await step("create Pro store and owner account", async () => {
      await admin.goto(`${BASE}/admin/instances/new`);
      await admin.getByLabel("Store name").fill("Design Test Shop");
      await admin.getByLabel("Subdomain").fill(SUB);
      await admin.locator("label", { hasText: "Every feature in the catalog" }).click();
      await admin.getByLabel("Owner name").fill("Omar Owner");
      await admin.getByLabel("Owner email").fill(OWNER.email);
      await admin.getByRole("button", { name: "Create instance" }).click();
      await see(admin, "Store created");
      storeId = admin.url().split("/instances/")[1].split("?")[0];
      await admin.getByRole("button", { name: /Create owner setup link/ }).click();
      const link = await admin.locator("input[readonly]").inputValue();
      S = `${BASE}/s/${SUB}`;
      const op = await newPage();
      await op.goto(link);
      await op.getByLabel("New password").fill(OWNER.password);
      await op.getByLabel("Type it again").fill(OWNER.password);
      await op.getByRole("button", { name: "Set password and continue" }).click();
      await see(op, "ready to sell");
      global.op = op;
    });
    const op = global.op;

    await step("Design page needs F-15 and shows ready-made themes", async () => {
      await op.goto(`${S}/manage/features`);
      const sw = await opened(op, "F-15");
      if ((await sw.getAttribute("aria-checked")) !== "true") { await sw.click(); await op.waitForTimeout(1500); }
      for (const [n, p] of [["Wireless earbuds", 4500], ["Leather wallet", 2200], ["Desk lamp", 3100]]) {
        await op.goto(`${S}/manage/products/new`);
        await op.locator("input[name=name]").fill(n);
        await op.locator("input[name=price]").fill(String(p));
        await op.locator("input[name=stock]").fill("5");
        await op.getByRole("button", { name: "Add product" }).click();
        await op.waitForURL(/products\?saved=1/);
      }
      await op.goto(`${S}/manage`);
      await op.getByRole("link", { name: /Design/ }).first().click();
      await see(op, "Ready-made themes");
      await see(op, "Live preview");
      await op.screenshot({ path: `${SHOTS}/DZ-editor-default.png`, fullPage: true });
    });

    await step("pick a theme, change colours and banner, preview updates", async () => {
      await op.getByRole("button", { name: /Boutique/ }).click();
      const header = op.locator(".store-themed .st-header").first();
      await op.waitForFunction(() => getComputedStyle(document.querySelector(".store-themed .st-header")).backgroundColor === "rgb(251, 247, 244)");
      await op.getByLabel("Banner title").fill("Handmade in Lahore");
      await op.getByLabel("Banner button").fill("Shop now");
      await op.locator("details", { hasText: "Header and footer" }).locator(":scope > summary").click();
      const headerInput = op.locator("label", { hasText: /^Header#/ }).locator("input[type=color]");
      await headerInput.evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, "#123456"); el.dispatchEvent(new Event("input", { bubbles: true })); });
      await op.waitForFunction(() => getComputedStyle(document.querySelector(".store-themed .st-header")).backgroundColor === "rgb(18, 52, 86)");
      await op.locator(".store-themed").getByText("Handmade in Lahore").waitFor();
      if (await header.count() !== 1) throw new Error("preview header missing");
      await op.screenshot({ path: `${SHOTS}/DZ-editor-boutique.png`, fullPage: true });
    });

    await step("save, and the storefront uses the design", async () => {
      await op.getByRole("button", { name: "Save design" }).click();
      await see(op, "Design saved");
      const shop = await newPage({ viewport: { width: 1280, height: 900 } });
      await shop.goto(S);
      await shop.locator(".store-themed").first().waitFor();
      const bg = await shop.locator("header.st-header").evaluate((el) => getComputedStyle(el).backgroundColor);
      if (bg !== "rgb(18, 52, 86)") throw new Error("storefront header colour " + bg);
      await see(shop, "Handmade in Lahore");
      await shop.getByRole("link", { name: "Shop now" }).waitFor();
      const cols = await shop.locator("ul.st-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      if (cols !== 3) throw new Error("expected 3 products per row, got " + cols);
      const font = await shop.locator("h1").first().evaluate((el) => getComputedStyle(el).fontFamily);
      if (!/Playfair/.test(font)) throw new Error("heading font " + font);
      await shop.screenshot({ path: `${SHOTS}/DZ-store-boutique.png`, fullPage: true });
    });

    await step("other themes look right on the storefront", async () => {
      for (const name of ["Midnight", "Fresh grocery", "Bold streetwear", "Luxury gold"]) {
        await op.getByRole("button", { name: new RegExp(name) }).click();
        await op.getByRole("button", { name: "Save design" }).click();
        await see(op, "Design saved");
        const shop = await newPage();
        await shop.goto(S);
        await shop.locator(".store-themed").first().waitFor();
        await shop.screenshot({ path: `${SHOTS}/DZ-store-${name.split(" ")[0].toLowerCase()}.png`, fullPage: true });
        await shop.context().close();
      }
    });

    await step("reset goes back to the plain look", async () => {
      op.once("dialog", (d) => d.accept());
      await op.getByRole("button", { name: "Reset to default" }).click();
      await see(op, "Design reset");
      const shop = await newPage();
      await shop.goto(S);
      await shop.locator("header").first().waitFor();
      if (await shop.locator(".store-themed").count()) throw new Error("theme still applied after reset");
    });

    await step("cleanup: export then delete the store", async () => {
      const [st] = await admin.evaluate(async (u) => { const r = await fetch(u); await r.text(); return [r.status]; }, `${BASE}/admin/instances/${storeId}/export`);
      if (st !== 200) throw new Error("export " + st);
      await admin.goto(`${BASE}/admin/instances/${storeId}`);
      await admin.getByText("Delete this store…").click();
      await admin.getByLabel(/Type "/).fill(SUB);
      await admin.getByRole("button", { name: "Delete store permanently" }).click();
      await see(admin, "Welcome back");
    });
  } catch {
    // recorded
  } finally {
    await browser.close();
    const fails = results.filter((r) => r[0] === "FAIL").length;
    console.log(`\n${results.length - fails} passed, ${fails} failed`);
    process.exit(fails ? 1 : 0);
  }
})();
