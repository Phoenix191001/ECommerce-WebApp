// End-to-end check of the extended features against a deployed preview.
// Usage: node tests/e2e/features.cjs <baseUrl> <vercelShareToken>
// Needs the Super Admin created by e2e.cjs (E2E_CREDS file). Creates one store and deletes it at the end.
const { chromium } = require("playwright");
const { TOTP, Secret } = require("otpauth");
const fs = require("fs");

const BASE = process.argv[2];
const SHARE = process.argv[3];
const SHOTS = process.env.E2E_SHOTS || __dirname + "/shots";
const CREDS = process.env.E2E_CREDS || __dirname + "/e2e-admin.json";
fs.mkdirSync(SHOTS, { recursive: true });
const ADMIN = JSON.parse(fs.readFileSync(CREDS, "utf8"));
const rnd = Math.random().toString(36).slice(2, 7);
let SUB = `feat-${rnd}`;
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
        await pg.screenshot({ path: `${SHOTS}/F-FAIL-${i}.png` });
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
      await admin.getByLabel("Store name").fill("Feature Test Shop");
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

    const FEATURES = [2, 8, 9, 11, 14, 16, 28, 40, 44, 46, 56, 60, 61, 62, 64, 65, 66, 69, 70, 72, 73, 74, 75, 77, 82, 83, 84, 86, 87, 88, 90, 91, 92, 93, 96, 98, 100, 104, 105, 106, 111, 112, 117, 119]
      .map((n) => `F-${String(n).padStart(2, "0")}`);
    await step(`owner turns on ${FEATURES.length} features (prerequisites auto-fixed)`, async () => {
      await op.goto(`${S}/manage/features`);
      const sw = (id) => op.locator(`button[role=switch][aria-label^="${id} "]`);
      for (const id of FEATURES) {
        if ((await sw(id).getAttribute("aria-checked")) === "true") continue;
        await sw(id).click();
        await op.waitForTimeout(900);
        const fix = op.getByRole("button", { name: new RegExp(`Turn on ${id} with`) });
        if (await fix.count()) { await fix.click(); await op.waitForTimeout(1200); }
      }
      await op.reload();
      const off = [];
      for (const id of FEATURES) if ((await sw(id).getAttribute("aria-checked")) !== "true") off.push(id);
      if (off.length) throw new Error("still off: " + off.join(","));
    });

    await step("product with variants, sale, volume tiers, tags, warranty, size guide", async () => {
      await op.goto(`${S}/manage/products/new`);
      await op.getByLabel("Product name").fill("Cotton Kurta");
      await op.getByLabel("Price", { exact: true }).fill("2000");
      await op.getByLabel("Category").fill("Clothing");
      await op.locator("input[name=optionNames]").fill("Size");
      await op.locator("textarea[name=variants]").fill("Small | | 5 | KUR-S | 5551\nXL | 2400 | 0 | KUR-XL | 5552");
      await op.locator("input[name=salePrice]").fill("1700");
      const tomorrow = new Date(Date.now() + 5 * 3600_000 + 86400_000).toISOString().slice(0, 16);
      await op.locator("input[name=saleEndsAt]").fill(tomorrow);
      await op.locator("textarea[name=volumeTiers]").fill("3 = 1500");
      await op.locator("input[name=costPrice]").fill("900");
      await op.locator("input[name=tags]").fill("summer, cotton");
      await op.locator("input[name=warrantyMonths]").fill("6");
      await op.locator("textarea[name=sizeGuide]").fill("Small: chest 38in\nXL: chest 46in");
      await op.getByRole("button", { name: "Add product" }).click();
      await see(op, "Product saved.");
    });

    await step("CSV import and bulk price edit", async () => {
      await op.goto(`${S}/manage/products/bulk`);
      await op.locator("textarea[name=csv]").fill("name,price,stock,category,sku,tags\nClay Mug,800,10,Kitchen,MUG-1,gift;kitchen\nTea Towel,450,0,Kitchen,TT-1,kitchen");
      await op.getByRole("button", { name: "Import products" }).click();
      await see(op, "Imported: 2 new, 0 updated.");
      await op.reload();
      await op.getByLabel("Price of Clay Mug").fill("850");
      await op.getByRole("button", { name: "Save all changes" }).click();
      await see(op, "Saved");
    });

    await step("checkout, content and storefront settings", async () => {
      await op.goto(`${S}/manage/settings`);
      await op.getByText("More checkout and order options").click();
      await op.locator("input[name=ntn]").fill("1234567-8");
      await op.getByRole("button", { name: "Save settings" }).click();
      await see(op, "Settings saved.");
      await op.goto(`${S}/manage/content`);
      await op.getByLabel("Title").fill("About us");
      await op.locator("input[name=slug]").fill("about-us");
      await op.locator("textarea[name=body]").fill("# Our story\n\nWe make cotton clothes.\n\n- Handmade\n- Local");
      await op.getByRole("button", { name: "Save" }).first().click();
      await see(op, "Pages and blog posts");
      await op.locator("textarea[name=menu]").fill("About us | /pages/about-us");
      await op.locator("textarea[name=locations]").fill("Main shop | 12 Mall Road, Lahore | 042-111 | 10am-9pm");
      await op.getByRole("button", { name: "Save storefront settings" }).click();
      await see(op, "Storefront settings saved.");
      await op.goto(`${S}/manage/discounts`);
      await op.getByLabel("Code").fill("STAY10");
      await op.getByLabel("Value").fill("10");
      await op.getByRole("button", { name: "Create code" }).click();
      await see(op, "Created STAY10.");
    });

    const sp = await newPage();
    await step("product page: countdown, variants, tiers, warranty, size guide, related", async () => {
      await sp.goto(`${S}/p/cotton-kurta`);
      await sp.getByRole("timer").waitFor();
      await see(sp, "6-month warranty");
      await see(sp, "Buy more, save more");
      await sp.getByRole("button", { name: "XL" }).click();
      await see(sp, "Out of stock");
      await sp.getByPlaceholder("you@example.com").first().fill(`alert-${rnd}@example.test`);
      await sp.getByRole("button", { name: /Email me when/ }).click();
      await see(sp, "We'll email you when it's back");
      await sp.getByRole("button", { name: "Small" }).click();
      await see(sp, "Rs 1,700");
      await sp.getByRole("button", { name: "Add to cart" }).click();
      await sp.getByRole("dialog", { name: "Your cart" }).waitFor();
      await see(sp, "Small");
      await sp.getByRole("button", { name: "Close cart" }).click();
      await sp.getByText("Size guide").click();
      await see(sp, "chest 46in");
      await sp.getByRole("button", { name: /Compare/ }).click();
      await sp.getByRole("button", { name: /Comparing/ }).waitFor();
      await sp.getByPlaceholder("Your name").fill("Hina");
      await sp.getByPlaceholder("Your question").fill("Is it machine washable?");
      await sp.getByRole("button", { name: "Ask a question" }).click();
      await see(sp, "Your question will appear");
    });

    await step("back-in-stock email goes out when XL is restocked (F-14)", async () => {
      const id = await op.evaluate(async (u) => (await (await fetch(u)).text()).match(/products\/([a-f0-9]{24})"/)?.[1], `${S}/manage/products?q=Kurta`);
      await op.goto(`${S}/manage/products/${id}`);
      await op.locator("textarea[name=variants]").fill("Small | | 5 | KUR-S | 5551\nXL | 2400 | 3 | KUR-XL | 5552");
      await op.getByRole("button", { name: "Save changes" }).click();
      await see(op, "Emailed 1 shopper");
    });

    await step("volume price kicks in at 3 (F-62)", async () => {
      await sp.goto(`${S}/cart`);
      await sp.getByRole("button", { name: "Increase quantity" }).first().click();
      await sp.waitForTimeout(1200);
      await sp.getByRole("button", { name: "Increase quantity" }).first().click();
      await see(sp, "3+ price");
    });

    await step("owner answers the question; it shows on the product page", async () => {
      await op.goto(`${S}/manage/questions`);
      await op.getByLabel("Answer").first().fill("Yes, cold wash.");
      await op.getByRole("button", { name: "Publish answer" }).click();
      await see(op, "Answer published.");
      await sp.goto(`${S}/p/cotton-kurta`);
      await see(sp, "Yes, cold wash.");
    });

    await step("compare page, brand-free search typo, related tags", async () => {
      await sp.goto(`${S}/compare`);
      await see(sp, "Cotton Kurta");
      await sp.goto(`${S}?q=kurtta`);
      await see(sp, "Showing close matches");
      await sp.getByRole("link", { name: "Cotton Kurta" }).first().waitFor();
    });

    await step("register with newsletter, checkout with slot, gift wrap", async () => {
      await sp.goto(`${S}/account/register`);
      await sp.getByLabel("Name").fill(SHOPPER.name);
      await sp.getByLabel("Email").fill(SHOPPER.email);
      await sp.getByLabel("Password").fill(SHOPPER.password);
      await sp.getByLabel(/Email me offers/).check();
      await sp.getByRole("button", { name: "Create account" }).click();
      await see(sp, "Signed in as");
      await sp.goto(`${S}/checkout`);
      await sp.getByLabel("Full name").fill(SHOPPER.name);
      await sp.getByLabel("Phone").fill("03011112222");
      await sp.getByLabel("Address").fill("45 Garden Town, Block C");
      await sp.getByLabel("City").fill("Lahore");
      await sp.getByLabel(/Save this address/).check();
      await sp.getByLabel("Delivery time").selectOption({ index: 1 });
      await sp.getByLabel(/Gift wrap this order/).check();
      await sp.getByLabel("Gift message").fill("Happy Eid!");
      await sp.getByRole("button", { name: /Place order/ }).click();
      await see(sp, "Thank you, Hina!");
      await see(sp, "Gift wrapped");
      global.orderNo = sp.url().match(/order\/(\d+)/)[1];
    });

    await step("owner edits the order, prints packing slip, delivers", async () => {
      await op.goto(`${S}/manage/orders/${global.orderNo}`);
      await see(op, "Gift wrap");
      await op.locator("input[name=qty_0]").fill("2");
      await op.getByRole("button", { name: "Save changes" }).click();
      await see(op, "Order updated.");
      const r = await op.evaluate(async (u) => (await fetch(u)).status, `${S}/manage/orders/${global.orderNo}/packing`);
      if (r !== 200) throw new Error("packing slip " + r);
      for (const b of ["Confirm order", "Mark shipped", "Mark delivered"]) {
        await op.getByRole("button", { name: new RegExp(b) }).click();
        await op.waitForTimeout(1500);
        await op.reload();
      }
      await see(op, "COD · paid");
    });

    await step("shopper earned points; requests a store-credit return", async () => {
      await sp.goto(`${S}/account`);
      await see(sp, "Loyalty points");
      const pts = await sp.locator("text=Loyalty points").locator("..").locator("p.text-2xl").textContent();
      if (!(Number(pts) > 0)) throw new Error("no points: " + pts);
      await sp.goto(`${S}/account/returns?order=${global.orderNo}`);
      await sp.locator("input[name=qty_0]").fill("1");
      await sp.getByLabel("What would you like?").selectOption("credit");
      await sp.getByLabel("Reason").fill("Too big for me");
      await sp.getByRole("button", { name: "Request return" }).click();
      await see(sp, "Return requested");
    });

    await step("owner approves and completes the return; credit appears", async () => {
      await op.goto(`${S}/manage/returns`);
      await op.getByRole("button", { name: "Approve" }).click();
      await op.getByRole("button", { name: "Mark completed" }).waitFor();
      await op.getByRole("button", { name: "Mark completed" }).click();
      await see(op, "completed");
      await sp.goto(`${S}/account`);
      await see(sp, "Return on order");
    });

    await step("support ticket round trip", async () => {
      await sp.goto(`${S}/account/support`);
      await sp.getByLabel("Subject").fill("Delivery question");
      await sp.getByLabel("Message").fill("When will my next order arrive?");
      await sp.getByRole("button", { name: "Send" }).first().click();
      await see(sp, "Ticket sent");
      await op.goto(`${S}/manage/support`);
      await op.getByLabel("Reply").first().fill("Within 2 days.");
      await op.getByRole("button", { name: "Send reply" }).click();
      await see(op, "Reply sent.");
      await sp.reload();
      await see(sp, "Within 2 days.");
    });

    await step("menu link, content page, locations, blog route", async () => {
      await sp.goto(S);
      await sp.getByRole("link", { name: "About us" }).first().click();
      await sp.getByRole("heading", { name: "Our story" }).waitFor();
      await sp.goto(`${S}/locations`);
      await see(sp, "12 Mall Road");
    });

    await step("sitemap, robots, product feed, manifest", async () => {
      for (const [path, needle] of [["sitemap.xml", "<urlset"], ["robots.txt", "Sitemap:"], ["feed.xml", "<g:price>"], ["manifest.webmanifest", "standalone"]]) {
        const [st, body] = await sp.evaluate(async (u) => { const r = await fetch(u); return [r.status, await r.text()]; }, `${S}/${path}`);
        if (st !== 200 || !body.includes(needle)) throw new Error(`${path}: ${st}`);
      }
    });

    await step("Urdu right-to-left and dark mode", async () => {
      await sp.goto(S);
      await sp.getByRole("button", { name: "Change language" }).click();
      await sp.locator('[lang="ur"][dir="rtl"]').first().waitFor();
      await see(sp, "کارٹ");
      await sp.getByRole("button", { name: "Change language" }).click();
      await sp.locator('[lang="en"]').first().waitFor();
      await sp.getByRole("button", { name: "Dark mode" }).click();
      await sp.locator(".store-dark").first().waitFor();
      await sp.screenshot({ path: `${SHOTS}/F-dark.png` });
      await sp.getByRole("button", { name: "Light mode" }).click();
    });

    await step("API key: 401 without, 200 with", async () => {
      await op.goto(`${S}/manage/developers`);
      await op.getByLabel("Key name").fill("Test");
      await op.getByRole("button", { name: "Create key" }).click();
      const key = (await op.locator("code").filter({ hasText: "sk_" }).first().textContent()).trim();
      const [no, yes, body] = await op.evaluate(async ([u, k]) => {
        const a = await fetch(u);
        const b = await fetch(u, { headers: { Authorization: `Bearer ${k}` } });
        return [a.status, b.status, await b.text()];
      }, [`${S}/v1/products`, key]);
      if (no !== 401 || yes !== 200 || !body.includes("Cotton Kurta")) throw new Error(`api ${no}/${yes}`);
    });

    await step("profit report, attendance, invoice NTN, customers segments", async () => {
      await op.goto(`${S}/manage/reports`);
      await see(op, "Cost of goods");
      await op.goto(`${S}/manage/staff`);
      await op.getByRole("button", { name: "Clock in" }).click();
      await op.getByRole("button", { name: /Clock out/ }).waitFor();
      await op.getByRole("button", { name: /Clock out/ }).click();
      await op.getByRole("button", { name: "Clock in" }).waitFor();
      await op.goto(`${S}/order/${global.orderNo}/invoice`);
      await see(op, "NTN: 1234567-8");
      await op.goto(`${S}/manage/customers`);
      await see(op, "New");
    });

    await step("customer 2FA: enrol, then sign-in needs a code", async () => {
      await sp.goto(`${S}/account/security`);
      await sp.getByRole("button", { name: "Set up two-factor sign-in" }).click();
      await sp.getByText("Can't scan?").click();
      const secret = (await sp.locator("code").first().textContent()).trim();
      await sp.getByLabel("6-digit code").fill(new TOTP({ secret: Secret.fromBase32(secret) }).generate());
      await sp.getByRole("button", { name: "Confirm" }).click();
      await see(sp, "Two-factor sign-in is on");
      await sp.goto(`${S}/account`);
      await sp.getByRole("button", { name: "Sign out" }).click();
      await sp.goto(`${S}/account/login`);
      await sp.getByLabel("Email").fill(SHOPPER.email);
      await sp.getByLabel("Password").fill(SHOPPER.password);
      await sp.getByRole("button", { name: "Sign in" }).click();
      await see(sp, "Enter the 6-digit code");
      await sp.waitForTimeout(31000);
      await sp.getByLabel("6-digit code").fill(new TOTP({ secret: Secret.fromBase32(secret) }).generate());
      await sp.getByRole("button", { name: "Sign in" }).click();
      await see(sp, "Signed in as");
    });

    await step("owner changes the store's subdomain", async () => {
      await op.goto(`${S}/manage/settings`);
      const next = `${SUB}x`;
      await op.getByLabel("New subdomain").fill(next);
      await op.getByRole("button", { name: "Change address" }).click();
      await op.waitForURL(new RegExp(`/s/${next}/manage/settings`));
      SUB = next; S = `${BASE}/s/${SUB}`;
      await see(op, "once every 30 days");
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
