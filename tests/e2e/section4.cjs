// End-to-end check of the section 4 features (digital, bundles, gift cards, warehouses, marketplace…).
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
let SUB = `s4-${rnd}`;
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
        await pg.screenshot({ path: `${SHOTS}/S4-FAIL-${i}.png` });
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
      await admin.getByLabel("Store name").fill("Section Four Shop");
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
    const sw = (id) => op.locator(`button[role=switch][aria-label^="${id} "]`);
    const FEATURES = [12, 13, 32, 45, 47, 55, 57, 63, 67, 71, 78, 80, 81, 85, 99, 108, 109, 114, 116, 28, 34, 40]
      .map((n) => `F-${String(n).padStart(2, "0")}`);
    await step(`owner turns on ${FEATURES.length} features`, async () => {
      await op.goto(`${S}/manage/features`);
      for (const id of FEATURES) {
        if ((await sw(id).getAttribute("aria-checked")) === "true") continue;
        await (await opened(op, id)).click();
        const fix = op.getByRole("button", { name: new RegExp(`Turn on ${id} with`) });
        for (let i = 0; i < 40; i++) {
          await op.waitForTimeout(250);
          if (await fix.count()) { await fix.click(); await op.waitForTimeout(1500); break; }
          if (!(await op.getByText("Saving…").count()) && (await sw(id).getAttribute("aria-checked")) === "true" && i > 3) break;
        }
      }
      await op.reload();
      const off = [];
      for (const id of FEATURES) if ((await sw(id).getAttribute("aria-checked")) !== "true") off.push(id);
      if (off.length) throw new Error("still off: " + off.join(","));
    });

    const addProduct = async (name, price, stock, extra) => {
      await op.goto(`${S}/manage/products/new`);
      await op.locator("input[name=name]").fill(name);
      await op.locator("input[name=price]").fill(String(price));
      await op.locator("input[name=stock]").fill(String(stock));
      if (extra) await extra();
      await op.getByRole("button", { name: "Add product" }).click();
      await op.waitForURL(/products\?saved=1/);
    };

    await step("products: simple, bundle, personalised, digital, gift card", async () => {
      await addProduct("Charger", 1200, 10);
      await addProduct("Cable", 300, 10);
      await addProduct("Power Bundle", 1500, 0, async () => {
        await op.getByText("🧺 Bundle").click();
        await op.getByLabel("Bundle item 1").selectOption({ label: "Charger" });
        await op.getByRole("button", { name: "➕ Add item" }).click();
        await op.getByLabel("Bundle item 2").selectOption({ label: "Cable" });
        await op.getByLabel("Quantity").nth(1).fill("2");
      });
      await addProduct("Engraved Pen", 800, 5, async () => {
        await op.getByText("✍️ Personalisation fields").click();
        await op.locator("textarea[name=customFields]").fill("Name to engrave | required | 20");
      });
      await addProduct("Recipe Ebook", 500, 0, async () => {
        await op.locator("select[name=kind]").selectOption("digital");
        // File uploads go straight to Vercel Blob, which this test machine can't reach: fill the hidden fields.
        await op.evaluate(() => {
          document.querySelector("input[name=digitalUrl]").value = "https://example.com/recipes.pdf";
          document.querySelector("input[name=digitalName]").value = "recipes.pdf";
        });
      });
      await addProduct("Gift Card 1000", 1000, 0, async () => { await op.locator("select[name=kind]").selectOption("giftcard"); });
      // Suggest the pen with the charger.
      await op.goto(`${S}/manage/products`);
      await op.getByRole("link", { name: /^🛍️?\s*Charger$/ }).first().click();
      await op.getByText("🛒 Suggest with this product").click();
      await op.getByRole("checkbox", { name: "Engraved Pen" }).check();
      await op.getByRole("button", { name: "Save changes" }).click();
      await see(op, "Saved.");
    });

    const sp = await newPage();
    const addToCart = async (slug, fill) => {
      await sp.goto(`${S}/p/${slug}`);
      if (fill) await fill();
      await sp.getByRole("button", { name: "Add to cart" }).first().click();
      await sp.waitForTimeout(1500);
    };
    const checkout = async (opts = {}) => {
      await sp.goto(`${S}/checkout`);
      await sp.getByRole("textbox", { name: "Full name" }).fill("Sana Shopper");
      await sp.getByRole("textbox", { name: "Phone" }).fill("03001234567");
      await sp.getByRole("textbox", { name: "Email" }).fill(`sana-${rnd}@example.test`);
      if (opts.address !== false) {
        await sp.getByRole("textbox", { name: "Address" }).fill("12 Mall Road");
        await sp.getByRole("textbox", { name: "City" }).fill("Lahore");
      }
      if (opts.giftCard) await sp.locator("input[name=giftCard]").fill(opts.giftCard);
      await sp.getByRole("button", { name: /Place order/ }).click();
      await sp.waitForURL(/\/order\/\d+/);
      return Number(sp.url().match(/\/order\/(\d+)/)[1]);
    };
    let order1 = 0;
    await step("personalised pen + bundle: cart, suggestions, checkout, bundle stock", async () => {
      await addToCart("engraved-pen", async () => {
        await sp.getByRole("button", { name: "Add to cart" }).click();
        await see(sp, 'Fill in "Name to engrave" first.');
        await sp.getByRole("textbox", { name: /Name to engrave/ }).fill("ALI");
      });
      await addToCart("power-bundle");
      await sp.goto(`${S}/cart`);
      await see(sp, "Name to engrave:");
      await see(sp, "1 × Charger, 2 × Cable");
      await see(sp, "Frequently bought together");
      order1 = await checkout();
      await see(sp, "Name to engrave: ALI");
      await op.goto(`${S}/manage/products`);
      const row = (n) => op.locator("tr", { has: op.getByRole("link", { name: new RegExp(`${n}$`) }) }).locator("td").nth(2);
      if ((await row("Charger").innerText()).trim() !== "9") throw new Error("charger stock " + (await row("Charger").innerText()));
      if ((await row("Cable").innerText()).trim() !== "8") throw new Error("cable stock " + (await row("Cable").innerText()));
    });

    await step("partial shipments: pen first, then the bundle", async () => {
      await op.goto(`${S}/manage/orders/${order1}`);
      await op.getByRole("button", { name: /Confirm order/ }).click();
      await see(op, "Ship part of this order");
      await op.getByLabel(/Ship how many Power Bundle/).fill("0");
      await op.locator("input[name=courier]").fill("TCS");
      await op.locator("input[name=tracking]").fill("TCS123");
      await op.getByRole("button", { name: /Ship these items/ }).click();
      await see(op, "Shipment saved. The rest is still to ship.");
      await op.reload();
      await op.getByRole("button", { name: /Ship these items/ }).click();
      await see(op, "Shipment 2: Power Bundle × 1"); // the ship card closes once everything is shipped
      await sp.reload();
      await see(sp, "Shipment 2");
      await see(sp, "TCS123");
    });

    let giftCode = "";
    await step("gift card made at the counter, used on a download order", async () => {
      await op.goto(`${S}/manage/gift-cards`);
      await op.locator("input[name=amount]").fill("300");
      await op.getByRole("button", { name: "Create gift card" }).click();
      const msg = await op.getByRole("status").filter({ hasText: "Gift card" }).first().innerText();
      giftCode = msg.match(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/)[0];
      await addToCart("recipe-ebook");
      await sp.goto(`${S}/checkout`);
      await see(sp, "Nothing to deliver");
      const n = await checkout({ address: false, giftCard: giftCode.toLowerCase() });
      await see(sp, "Your download link appears here once the store confirms your order.");
      await op.goto(`${S}/manage/orders/${n}`);
      await see(op, `Gift card ${giftCode}`);
      await op.getByRole("button", { name: /Confirm order/ }).click();
      await op.waitForTimeout(1500);
      await sp.reload();
      const href = await sp.getByRole("link", { name: /Download: Recipe Ebook/ }).getAttribute("href");
      const st = await sp.evaluate(async (u) => (await fetch(u, { redirect: "manual" })).type, href);
      if (st !== "opaqueredirect") throw new Error("download did not redirect: " + st);
      await op.goto(`${S}/manage/gift-cards`);
      await see(op, "Rs 0");
    });

    await step("buying a gift card issues a code when confirmed", async () => {
      await addToCart("gift-card-1000", async () => { await sp.getByRole("textbox", { name: "Recipient email" }).fill(`friend-${rnd}@example.test`); });
      const n = await checkout({ address: false });
      await see(sp, "Gift card codes appear here");
      await op.goto(`${S}/manage/orders/${n}`);
      await op.getByRole("button", { name: /Confirm order/ }).click();
      await see(op, "Gift cards issued:");
      await sp.reload();
      await sp.locator("li.font-mono, .font-mono li").first().waitFor();
    });

    await step("warehouses: add, move, count", async () => {
      await op.goto(`${S}/manage/warehouses`);
      await op.locator("form", { has: op.getByRole("button", { name: "➕ Add location" }) }).locator("input[name=name]").fill("Lahore godown");
      await op.getByRole("button", { name: "➕ Add location" }).click();
      await see(op, "Lahore godown added.");
      await op.reload();
      const move = op.locator("form", { has: op.getByRole("button", { name: "Move" }) });
      await move.locator("select[name=product]").selectOption({ label: "Charger" });
      await move.locator("select[name=from]").selectOption({ label: "Main warehouse" });
      await move.locator("select[name=to]").selectOption({ label: "Lahore godown" });
      await move.locator("input[name=qty]").fill("3");
      await op.getByRole("button", { name: "Move" }).click();
      await see(op, "Moved 3 × Charger.");
      const count = op.locator("form", { has: op.getByRole("button", { name: "Save count" }) });
      await count.locator("select[name=product]").selectOption({ label: "Charger" });
      await count.locator("select[name=warehouse]").selectOption({ label: "Lahore godown" });
      await count.locator("input[name=qty]").fill("5");
      await op.getByRole("button", { name: "Save count" }).click();
      await see(op, "Charger: 3 → 5.");
      await op.reload();
      const cells = await op.locator("tr", { hasText: "Charger" }).last().locator("td").allInnerTexts();
      if (cells.slice(1).join(",") !== "6,5,11") throw new Error("stock by location " + cells.join(","));
    });

    await step("purchase order: create and receive", async () => {
      await op.goto(`${S}/manage/purchase-orders`);
      await op.locator("input[name=supplier]").fill("Karachi Wholesale");
      await op.getByLabel("Item 1").selectOption({ label: "Cable" });
      await op.getByLabel("Quantity", { exact: true }).fill("20");
      await op.getByLabel("Unit cost", { exact: true }).fill("120");
      await op.getByRole("button", { name: "Save purchase order" }).click();
      await see(op, "saved.");
      await op.reload();
      await op.getByRole("button", { name: /Receive these/ }).click();
      await see(op, "(20 received)"); // the receive form closes once everything arrived
      await op.goto(`${S}/manage/products`);
      const cable = await op.locator("tr", { has: op.getByRole("link", { name: /Cable$/ }) }).locator("td").nth(2).innerText();
      if (cable.trim() !== "28") throw new Error("cable after PO " + cable);
    });

    await step("POS keeps selling offline and syncs later", async () => {
      await op.goto(`${S}/manage/pos`);
      await op.getByRole("button", { name: /Cable/ }).first().waitFor();
      await op.context().setOffline(true);
      await op.getByRole("button", { name: /Cable/ }).first().click();
      await op.getByLabel("Cash received").fill("1000");
      await op.getByRole("button", { name: "Complete sale" }).click();
      await see(op, "Offline: sale saved on this device");
      await see(op, "1 sale(s) waiting to sync.");
      await op.context().setOffline(false);
      await op.getByText("waiting to sync").waitFor({ state: "detached", timeout: 30000 });
      await op.goto(`${S}/manage/orders`);
      await op.getByText("POS").first().waitFor();
      const posOrder = await op.locator("tr", { hasText: "POS" }).first().getByRole("link").first().innerText();
      await op.goto(`${S}/manage/orders/${posOrder.replace("#", "")}`);
      await see(op, "sold offline at");
    });

    await step("display currency", async () => {
      await op.goto(`${S}/manage/settings`);
      await op.locator("textarea[name=currencies]").fill("USD = 0.0036");
      await op.getByRole("button", { name: "Save currencies" }).click();
      await see(op, "Shoppers can now pick USD.");
      await sp.goto(`${S}/p/charger`);
      await sp.getByLabel("Currency").selectOption("USD");
      await sp.waitForTimeout(2000);
      await see(sp, "$4.32");
      await sp.getByLabel("Currency").selectOption("PKR");
      await sp.waitForTimeout(1500);
    });

    await step("page builder home page", async () => {
      await op.goto(`${S}/manage/content`);
      await op.locator("input[name=title]").fill("Welcome page");
      await op.getByRole("button", { name: /Big banner/ }).click();
      await op.getByRole("button", { name: /🛍️ Products/ }).click();
      await op.locator("form", { has: op.locator("input[name=title]") }).getByRole("button", { name: "Save" }).click();
      await op.waitForURL(/\/manage\/content$/);
      await op.locator("select[name=homePage]").selectOption({ label: "Welcome page" });
      await op.locator("form", { has: op.locator("select[name=homePage]") }).getByRole("button", { name: "Save" }).click();
      await see(op, "Your home page now shows that page.");
      await sp.goto(S);
      await see(sp, "Your headline");
      await see(sp, "Featured products");
    });

    await step("app store: sales pop-up shows real orders", async () => {
      await op.goto(`${S}/manage/apps`);
      const card = op.locator("section", { hasText: "Recent sales pop-up" });
      await card.locator("summary", { hasText: "Install" }).click();
      await card.getByRole("button", { name: "Install" }).click();
      await card.getByRole("button", { name: "Pause" }).waitFor();
      await sp.goto(`${S}/cart`);
      await sp.getByText(/bought/).first().waitFor({ timeout: 20000 });
    });

    await step("live chat: shopper asks, staff replies", async () => {
      await sp.getByRole("button", { name: /Chat with us/ }).click();
      await sp.getByPlaceholder("Your name").fill("Sana");
      await sp.getByPlaceholder("Type a message…").fill("Do you deliver to Multan?");
      await sp.getByRole("button", { name: "Send" }).click();
      await see(sp, "Do you deliver to Multan?");
      await op.goto(`${S}/manage/chat`);
      await op.getByRole("button", { name: /Sana/ }).first().click();
      await see(op, "Do you deliver to Multan?");
      await op.getByLabel("Reply").fill("Yes, in 3 days!");
      await op.getByRole("button", { name: "Send" }).click();
      await sp.getByText("Yes, in 3 days!").waitFor({ timeout: 20000 });
    });

    await step("marketplace seller: invite, sign in, own products only", async () => {
      await op.goto(`${S}/manage/sellers`);
      const sf = op.locator("form", { has: op.getByRole("button", { name: "Add seller" }) });
      await sf.locator("input[name=name]").fill("Bilal Crafts");
      await sf.locator("input[name=email]").fill(`bilal-${rnd}@example.test`);
      await op.getByRole("button", { name: "Add seller" }).click();
      await see(op, "Bilal Crafts added.");
      const link = await op.getByLabel("Link").inputValue();
      const sel = await newPage();
      await sel.goto(link.startsWith("http") ? link : `${BASE}${link}`);
      await sel.getByLabel("New password").fill("SellerPass!234");
      await sel.getByLabel("Type it again").fill("SellerPass!234");
      await sel.getByRole("button", { name: "Set password and continue" }).click();
      await see(sel, "You sell through");
      await sel.goto(`${S}/manage/products`);
      await see(sel, "No products yet.");
      await sel.goto(`${S}/manage/products/new`);
      await sel.locator("input[name=name]").fill("Clay Pot");
      await sel.locator("input[name=price]").fill("900");
      await sel.locator("input[name=stock]").fill("4");
      await sel.getByRole("button", { name: "Add product" }).click();
      await sel.waitForURL(/products\?saved=1/);
      await see(sel, "Clay Pot");
      await sel.goto(`${S}/manage/settings`);
      await sel.waitForURL(/\/manage\/products/);
      await sp.goto(`${S}/p/clay-pot`);
      await see(sp, "Bilal Crafts");
    });

    await step("affiliate link earns a commission", async () => {
      await op.goto(`${S}/manage/affiliates`);
      const code = `AY${rnd}`.toUpperCase();
      const af = op.locator("form", { has: op.getByRole("button", { name: "Add affiliate" }) });
      await af.locator("input[name=name]").fill("Ayesha Blogger");
      await af.locator("input[name=email]").fill(`ayesha-${rnd}@example.test`);
      await af.locator("input[name=code]").fill(code);
      await op.getByRole("button", { name: "Add affiliate" }).click();
      await see(op, "Ayesha Blogger added");
      const ap = await newPage();
      await ap.goto(`${S}/a/${code}`);
      await ap.goto(`${S}/p/cable`);
      await ap.getByRole("button", { name: "Add to cart" }).first().click();
      await ap.waitForTimeout(1500);
      await ap.goto(`${S}/checkout`);
      await ap.getByRole("textbox", { name: "Full name" }).fill("Referred Buyer");
      await ap.getByRole("textbox", { name: "Phone" }).fill("03001112222");
      await ap.getByRole("textbox", { name: "Email" }).fill(`ref-${rnd}@example.test`);
      await ap.getByRole("textbox", { name: "Address" }).fill("1 Canal Road");
      await ap.getByRole("textbox", { name: "City" }).fill("Faisalabad");
      await ap.getByRole("button", { name: /Place order/ }).click();
      await ap.waitForURL(/\/order\/\d+/);
      await op.reload();
      await see(op, "1 clicks · 1 orders");
    });

    await step("A/B test splits visitors and counts views", async () => {
      await op.goto(`${S}/manage/content`);
      await op.locator("select[name=homePage]").selectOption({ value: "" });
      await op.locator("form", { has: op.locator("select[name=homePage]") }).getByRole("button", { name: "Save" }).click();
      await see(op, "product list again");
      await op.goto(`${S}/manage/experiments`);
      await op.locator("select[name=section]").selectOption("headline");
      await op.locator("textarea[name=a]").fill("Alpha headline");
      await op.locator("textarea[name=b]").fill("Beta headline");
      await op.getByRole("button", { name: "Start test" }).click();
      await see(op, "Test started.");
      const v = await newPage();
      await v.goto(S);
      await v.getByText(/Alpha headline|Beta headline/).first().waitFor();
      await op.reload();
      const views = (await op.locator("tbody tr td:nth-child(2)").allInnerTexts()).map(Number);
      if (views.reduce((a, b) => a + b, 0) < 1) throw new Error("views " + JSON.stringify(views));
    });

    await step("birthday points on the account page", async () => {
      const cp = await newPage();
      await cp.goto(`${S}/account/register`);
      await cp.getByRole("textbox", { name: "Name" }).fill("Birthday Person");
      await cp.getByRole("textbox", { name: "Email" }).fill(`bday-${rnd}@example.test`);
      await cp.getByLabel("Password").fill("BirthdayPass1");
      await cp.getByRole("button", { name: "Create account" }).click();
      await see(cp, "Your birthday");
      const month = new Date(Date.now() + 5 * 3600_000).getUTCMonth() + 1;
      await cp.getByLabel("Month").selectOption(String(month));
      await cp.getByLabel("Day", { exact: true }).fill("15");
      await cp.getByRole("button", { name: "Save" }).click();
      await see(cp, "Happy birthday!"); // given as soon as the page refreshes after saving
      await cp.reload();
      await cp.getByText("200", { exact: true }).waitFor();
    });

    await step("push page explains when keys are missing", async () => {
      await op.goto(`${S}/manage/notifications`);
      await op.getByText(/Subscribers|isn't set up/).first().waitFor();
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
