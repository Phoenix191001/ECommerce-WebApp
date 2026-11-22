// End-to-end check of self-serve signup (/start) and every step of the setup wizard.
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
let SUB = `wz-${rnd}`;
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
        await pg.screenshot({ path: `${SHOTS}/WZ-FAIL-${i}.png` });
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

    let op;
    await step("self-serve signup creates a store quickly", async () => {
      op = await newPage();
      await op.goto(`${BASE}/start`);
      await op.getByLabel("Store name").fill("Wizard Test Shop");
      await op.getByLabel("Store address").fill(SUB);
      await op.getByLabel("Your name").fill("Wajid Owner");
      await op.getByLabel("Email").fill(OWNER.email);
      await op.getByLabel("Password").fill(OWNER.password);
      const t = Date.now();
      await op.getByRole("button", { name: /Create my store/ }).click();
      await op.waitForURL(/manage\/welcome/);
      const ms = Date.now() - t;
      console.log(`  store created in ${ms} ms`);
      if (ms > 15000) throw new Error(`creating the store took ${ms} ms`);
      S = `${BASE}/s/${SUB}`;
    });

    await step("wizard: save branding moves on with a saved note", async () => {
      await op.getByLabel("Tagline").fill("Good things, delivered");
      await op.getByRole("button", { name: "Save branding" }).click();
      await op.waitForURL(/step=product&saved=brand/);
      await see(op, "Saved. On to the next step.");
      await see(op, "Add your first product");
    });

    await step("wizard: first product keeps you in the wizard", async () => {
      await op.locator("input[name=name]").fill("Clay mug");
      await op.locator("input[name=price]").fill("650");
      await op.locator("input[name=stock]").fill("8");
      await op.getByRole("button", { name: "Add product" }).click();
      await op.waitForURL(/welcome\?step=shipping&saved=product/);
      await see(op, "Delivery, tax, and contact");
    });

    await step("wizard: delivery settings move on to features", async () => {
      await op.getByRole("button", { name: "Save settings" }).click();
      await op.waitForURL(/step=features&saved=shipping/);
      await see(op, "Choose your features");
    });

    await step("wizard: starter pack button says what it did", async () => {
      await op.getByRole("button", { name: /Turn on the starter pack/ }).click();
      await op.getByText(/starter pack is already on|Turned on \d+ starter feature/).first().waitFor();
      await op.getByRole("link", { name: /Continue/ }).click();
      await see(op, "You're ready");
    });

    await step("wizard: finish setup goes to the dashboard", async () => {
      await op.getByRole("button", { name: /Finish setup/ }).click();
      await op.waitForURL(/manage\?setup=done/);
      await see(op, "Setup finished. Your store is ready to sell.");
    });

    await step("features page: starter pack button gives feedback", async () => {
      await op.goto(`${S}/manage/features`);
      await op.getByRole("button", { name: /Turn on starter pack/ }).click();
      await op.getByText(/starter pack is already on|Turned on \d+ starter feature/).first().waitFor();
    });

    await step("store front works with the product", async () => {
      await op.goto(S);
      await see(op, "Clay mug");
      await see(op, "Good things, delivered");
    });

    await step("super admin: apply starter pack gives feedback", async () => {
      await admin.goto(`${BASE}/admin/instances`);
      const href = await admin.locator(`a[href^='/admin/instances/']`).evaluateAll((as, sub) => as.filter((a) => a.closest("tr")?.textContent?.includes(sub)).map((a) => a.getAttribute("href")).find((h) => /\/[0-9a-f]{24}$/.test(h)), SUB);
      await admin.goto(BASE + href);
      await admin.getByRole("button", { name: /Apply starter pack/ }).click();
      await admin.getByText(/starter pack is already on|Turned on \d+ starter feature/).first().waitFor();
    });

    await step("cleanup: export then delete the store", async () => {
      await admin.goto(`${BASE}/admin/instances`);
      const href = await admin.locator(`a[href^='/admin/instances/']`).evaluateAll((as, sub) => as.filter((a) => a.closest("tr")?.textContent?.includes(sub)).map((a) => a.getAttribute("href")).find((h) => /\/[0-9a-f]{24}$/.test(h)), SUB);
      if (!href) throw new Error("store not listed");
      const storeId = href.split("/").pop();
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
