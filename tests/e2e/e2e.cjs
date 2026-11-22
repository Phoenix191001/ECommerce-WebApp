// End-to-end check against a deployed preview.
// Usage: npm run test:e2e -- <baseUrl> <vercelShareToken>
// Run it against a preview whose PLATFORM_DB_NAME points at a throwaway database: it creates a Super Admin,
// stores, orders and staff, then deletes the stores it created.
const { chromium } = require("playwright");

// Feature groups are dropdowns: open the one holding a switch before clicking it.
async function opened(p, id) {
  const sw = p.locator(`button[role=switch][aria-label^="${id} "]`);
  const closed = p.locator("details:not([open])", { has: sw });
  if (await closed.count()) await closed.locator(":scope > summary").click();
  return sw;
}
const { TOTP, Secret } = require("otpauth");

const BASE = process.argv[2];
const SHARE = process.argv[3];
const SHOTS = process.env.E2E_SHOTS || __dirname + "/shots";
require("fs").mkdirSync(SHOTS, { recursive: true });
const rnd = Math.random().toString(36).slice(2, 7);
const SUB = `e2e-${rnd}`;
const fs = require("fs");
const CREDS = process.env.E2E_CREDS || __dirname + "/e2e-admin.json";
const ADMIN = fs.existsSync(CREDS) ? JSON.parse(fs.readFileSync(CREDS, "utf8")) : { email: `admin-${rnd}@example.test`, password: "AdminPass!2345" };
const OWNER = { email: `owner-${rnd}@example.test`, password: "OwnerPass!2345" };
const results = [];
const ok = (name) => { results.push(["PASS", name]); console.log("PASS", name); };

const PAGES = [];
async function step(name, fn) {
  try { await fn(); ok(name); }
  catch (e) {
    for (const [i, pg] of PAGES.entries()) {
      try {
        await pg.screenshot({ path: `${SHOTS}/FAIL-${i}.png` });
        const alerts = await pg.locator("[role=alert]:not(#__next-route-announcer__)").allTextContents();
        console.log(`  page ${i} url=${pg.url()} alerts=${JSON.stringify(alerts)}`);
      } catch {}
    } results.push(["FAIL", name, String(e).slice(0, 400)]); console.log("FAIL", name, String(e).slice(0, 400)); throw e; }
}

(async () => {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  PAGES.push(page);
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false });
  const totpFrom = async (p) => {
    const secret = (await p.locator("code").first().textContent()).trim();
    return { secret, code: () => new TOTP({ secret: Secret.fromBase32(secret) }).generate() };
  };
  let storeId = "";

  try {
    await step("bypass deployment protection", async () => {
      await page.goto(`${BASE}/?_vercel_share=${SHARE}`);
      await page.getByText("Launch your online store").first().waitFor();
      await shot("01-landing");
    });

    await step("super admin setup + 2FA enrolment (or sign-in on rerun)", async () => {
      await page.goto(`${BASE}/admin/login`);
      if (ADMIN.secret) {
        await page.getByLabel("Email").fill(ADMIN.email);
        await page.getByLabel("Password").fill("wrong-password-123");
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByText("Email or password is incorrect").first().waitFor();
        await page.getByLabel("Password").fill(ADMIN.password);
        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByText("Two-factor check").first().waitFor();
        await page.getByLabel("6-digit code").fill(new TOTP({ secret: Secret.fromBase32(ADMIN.secret) }).generate());
        await page.getByRole("button", { name: "Verify and sign in" }).click();
        await page.getByText("Welcome back").first().waitFor();
        return;
      }
      await page.getByText("Create the Super Admin").first().waitFor();
      await page.getByLabel("Email").fill(ADMIN.email);
      await page.getByLabel("Password").fill(ADMIN.password);
      await page.getByRole("button", { name: "Create Super Admin" }).click();
      await page.getByText("Turn on two-factor sign-in").first().waitFor();
      await shot("02-2fa");
      await page.getByText("Can't scan?").click();
      const t = await totpFrom(page);
      ADMIN.secret = t.secret;
      fs.writeFileSync(CREDS, JSON.stringify(ADMIN));
      await page.getByLabel("6-digit code").fill("000000");
      await page.getByRole("button", { name: "Verify and sign in" }).click();
      await page.getByText("didn't match").first().waitFor();
      await page.getByLabel("6-digit code").fill(t.code());
      await page.getByRole("button", { name: "Verify and sign in" }).click();
      await page.getByText("Welcome back").first().waitFor();
      await page.getByText("Getting started").first().waitFor();
      // sign out and back in to prove the enrolled 2FA works
      await page.getByRole("button", { name: "Sign out" }).click();
      await page.getByLabel("Email").fill(ADMIN.email);
      await page.getByLabel("Password").fill(ADMIN.password);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByText("Two-factor check").first().waitFor();
      await page.waitForTimeout(31000); // next TOTP window so the code isn't the one just used
      await page.getByLabel("6-digit code").fill(t.code());
      await page.getByRole("button", { name: "Verify and sign in" }).click();
      await page.getByText("Welcome back").first().waitFor();
      await shot("03-admin-dashboard");
    });

    await step("plans page lists Starter and Pro", async () => {
      await page.goto(`${BASE}/admin/plans`);
      await page.getByText("💎 Starter").first().waitFor();
      await page.getByText("💎 Pro").first().waitFor();
    });

    await step("create store on Pro plan", async () => {
      await page.goto(`${BASE}/admin/instances/new`);
      await page.getByLabel("Store name").fill("E2E Gadget Shop");
      await page.getByLabel("Subdomain").fill(SUB);
      await page.locator("label", { hasText: "Every feature in the catalog" }).click();
      await page.getByLabel("Owner name").fill("Olivia Owner");
      await page.getByLabel("Owner email").fill(OWNER.email);
      await page.getByRole("button", { name: "Create instance" }).click();
      await page.getByText("Store created — what's next?").first().waitFor();
      storeId = page.url().split("/instances/")[1].split("?")[0];
      await shot("04-instance");
    });

    await step("prerequisite one-click fix (F-10 needs F-22)", async () => {
      const sw = (id) => page.locator(`button[role=switch][aria-label^="${id} "]`);
      await (await opened(page, "F-22")).click();
      await page.waitForTimeout(1500);
      await page.reload();
      if ((await sw("F-22").getAttribute("aria-checked")) !== "false") throw new Error("F-22 did not turn off");
      if ((await sw("F-10").getAttribute("aria-checked")) !== "false") {
        await (await opened(page, "F-10")).click(); await page.waitForTimeout(1500); await page.reload();
      }
      await (await opened(page, "F-10")).click();
      await page.getByText("F-10 needs F-22 turned on first").first().waitFor();
      await page.getByRole("button", { name: /Turn on F-10 with F-22/ }).click();
      await page.waitForTimeout(2000);
      await page.reload();
      for (const id of ["F-10", "F-22"]) if ((await sw(id).getAttribute("aria-checked")) !== "true") throw new Error(`${id} not on`);
    });

    await step("turn on POS features with prerequisites", async () => {
      const sw = (id) => page.locator(`button[role=switch][aria-label^="${id} "]`);
      for (const id of ["F-34", "F-35", "F-36", "F-38", "F-37", "F-39"]) {
        if ((await sw(id).getAttribute("aria-checked")) === "true") continue;
        await (await opened(page, id)).click();
        await page.waitForTimeout(1200);
      }
      await page.reload();
      for (const id of ["F-34", "F-35", "F-36", "F-37", "F-38", "F-39"]) if ((await sw(id).getAttribute("aria-checked")) !== "true") throw new Error(`${id} not on`);
    });

    let setupLink = "";
    await step("owner setup link", async () => {
      await page.getByRole("button", { name: /Create owner setup link/ }).click();
      const input = page.locator("input[readonly]");
      await input.waitFor();
      setupLink = await input.inputValue();
      if (!setupLink.includes("/manage/setup?token=")) throw new Error("bad link " + setupLink);
    });

    const owner = await ctx.browser().newContext({ viewport: { width: 1280, height: 900 } });
    const op = await owner.newPage();
    op.setDefaultTimeout(30000);
    PAGES.push(op);
    await op.goto(`${BASE}/?_vercel_share=${SHARE}`);
    const S = `${BASE}/s/${SUB}`;

    await step("owner sets password and lands in wizard", async () => {
      await op.goto(setupLink);
      await op.getByLabel("New password").fill(OWNER.password);
      await op.getByLabel("Type it again").fill(OWNER.password);
      await op.getByRole("button", { name: "Set password and continue" }).click();
      await op.getByText("Let's get E2E Gadget Shop ready to sell").first().waitFor();
      await op.screenshot({ path: `${SHOTS}/05-wizard.png` });
    });

    await step("wizard: branding", async () => {
      await op.getByRole("button", { name: "Use #db2777" }).click();
      await op.getByLabel("Tagline").fill("Gadgets delivered fast");
      await op.getByRole("button", { name: "Save branding" }).click();
      await op.getByText("Add your first product").first().waitFor(); // wizard advances after saving
      await op.goto(`${S}/manage/settings`);
      if ((await op.getByLabel("Tagline").inputValue()) !== "Gadgets delivered fast") throw new Error("tagline not saved");
    });

    await step("add products", async () => {
      for (const [name, price, stock, barcode, cat] of [["Wireless Earbuds", 3500, 20, "111222", "Audio"], ["Phone Charger", 1200, 3, "333444", "Power"]]) {
        await op.goto(`${S}/manage/products/new`);
        await op.locator("input[name=name]").fill(name);
        await op.locator("input[name=price]").fill(String(price));
        await op.locator("input[name=stock]").fill(String(stock));
        await op.locator("input[name=category]").fill(cat);
        await op.locator("input[name=barcode]").fill(barcode);
        await op.getByRole("button", { name: "Add product" }).click();
        await op.getByText("Product saved.").first().waitFor();
      }
      await op.getByText("Wireless Earbuds").first().waitFor();
    });

    await step("create discount code", async () => {
      await op.goto(`${S}/manage/discounts`);
      await op.getByLabel("Code").fill("TEST10");
      await op.getByLabel("Value").fill("10");
      await op.getByRole("button", { name: "Create code" }).click();
      await op.getByText("Created TEST10.").first().waitFor();
    });

    await step("store settings: announcement + free delivery", async () => {
      await op.goto(`${S}/manage/settings`);
      await op.getByLabel("Announcement bar").fill("Grand opening sale!");
      await op.getByRole("button", { name: "Save settings" }).click();
      await op.getByText("Settings saved.").first().waitFor();
    });

    // Shopper
    const shopper = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const sp = await shopper.newPage();
    sp.setDefaultTimeout(30000);
    PAGES.push(sp);
    await sp.goto(`${BASE}/?_vercel_share=${SHARE}`);
    let orderNo = "";

    await step("storefront shows brand, products, announcement", async () => {
      await sp.goto(S);
      await sp.getByText("Grand opening sale!").first().waitFor();
      await sp.getByRole("heading", { name: "E2E Gadget Shop" }).waitFor();
      await sp.getByText("Gadgets delivered fast").first().waitFor();
      await sp.getByRole("link", { name: "Wireless Earbuds" }).first().waitFor();
      await sp.screenshot({ path: `${SHOTS}/06-storefront-mobile.png` });
    });

    await step("search + category filter", async () => {
      await sp.goto(`${S}?cat=Power`);
      await sp.getByRole("link", { name: "Phone Charger" }).first().waitFor();
      if (await sp.getByRole("link", { name: "Wireless Earbuds" }).count()) throw new Error("filter leaked");
    });

    await step("add to cart opens drawer; stock limit enforced", async () => {
      await sp.goto(`${S}/p/phone-charger`);
      await sp.getByText("Only 3 left").first().waitFor();
      for (let i = 0; i < 3; i++) {
        await sp.getByRole("button", { name: "Add to cart" }).click();
        await sp.getByRole("dialog", { name: "Your cart" }).waitFor();
        await sp.getByRole("button", { name: "Close cart" }).click();
      }
      await sp.getByRole("button", { name: "Add to cart" }).click();
      await sp.getByText("Only 3 left in stock.").first().waitFor();
      await sp.goto(`${S}/p/wireless-earbuds`);
      await sp.getByRole("button", { name: "Add to cart" }).click();
      await sp.getByRole("dialog", { name: "Your cart" }).waitFor();
      await sp.screenshot({ path: `${SHOTS}/07-cart-drawer.png` });
    });

    await step("cart: discount code applies", async () => {
      await sp.goto(`${S}/cart`);
      await sp.getByLabel("Discount code").fill("test10");
      await sp.getByRole("button", { name: "Apply" }).click();
      await sp.getByText("Code TEST10 applied").first().waitFor();
      await sp.getByText("Discount (TEST10)").first().waitFor();
    });

    await step("guest checkout with cash on delivery", async () => {
      await sp.goto(`${S}/checkout`);
      await sp.getByLabel("Full name").fill("Sara Shopper");
      await sp.getByLabel("Phone").fill("03001234567");
      await sp.getByLabel("Email").fill(`sara-${rnd}@example.test`);
      await sp.getByLabel("Address").fill("12 Mall Road");
      await sp.getByLabel("City").fill("Lahore");
      await sp.getByRole("button", { name: /Place order/ }).click();
      await sp.getByText("Thank you, Sara!").first().waitFor();
      orderNo = sp.url().match(/order\/(\d+)/)[1];
      await sp.screenshot({ path: `${SHOTS}/08-order-confirmation.png` });
    });

    await step("stock was reserved (charger now out of stock)", async () => {
      await sp.goto(`${S}/p/phone-charger`);
      await sp.getByText("Out of stock").first().waitFor();
    });

    await step("track order lookup", async () => {
      await sp.goto(`${S}/track`);
      await sp.getByLabel("Order number").fill(orderNo);
      await sp.getByLabel("Email used for the order").fill(`sara-${rnd}@example.test`);
      await sp.getByRole("button", { name: "Track order" }).click();
      await sp.getByRole("heading", { name: `Order #${orderNo}` }).waitFor();
    });

    await step("owner moves order through statuses", async () => {
      await op.goto(`${S}/manage/orders/${orderNo}`);
      for (const b of ["Confirm order", "Mark shipped", "Mark delivered"]) {
        await op.getByRole("button", { name: new RegExp(b) }).click();
        await op.waitForTimeout(1500);
        await op.reload();
      }
      await op.getByText("COD · paid").first().waitFor();
      await op.screenshot({ path: `${SHOTS}/09-order-admin.png` });
    });

    await step("owner dashboard analytics", async () => {
      await op.goto(`${S}/manage`);
      await op.getByText("Sales, last 14 days").first().waitFor();
      await op.getByText("Top products").first().waitFor();
      await op.screenshot({ path: `${SHOTS}/10-owner-dashboard.png` });
    });

    await step("add manager with PIN and cashier with limit", async () => {
      await op.goto(`${S}/manage/staff`);
      await op.locator("input[name=name]").first().fill("Mona Manager");
      await op.locator("input[name=email]").first().fill(`mgr-${rnd}@example.test`);
      await op.locator("input[name=password]").first().fill("ManagerPass1");
      await op.locator("input[name=pin]").first().fill("4321");
      await op.getByRole("button", { name: "Add staff member" }).click();
      await op.getByText("Added Mona Manager").first().waitFor();
      await op.locator("input[name=name]").first().fill("Cal Cashier");
      await op.locator("input[name=email]").first().fill(`cash-${rnd}@example.test`);
      await op.locator("input[name=password]").first().fill("CashierPass1");
      await op.locator("select[name=role]").first().selectOption("cashier");
      await op.locator("input[name=refundLimit]").first().fill("500");
      await op.getByRole("button", { name: "Add staff member" }).click();
      await op.getByText("Added Cal Cashier").first().waitFor();
    });

    // Cashier
    const cashier = await ctx.browser().newContext({ viewport: { width: 1280, height: 900 } });
    const cp = await cashier.newPage();
    cp.setDefaultTimeout(30000);
    PAGES.push(cp);
    await cp.goto(`${BASE}/?_vercel_share=${SHARE}`);
    let posNo = "";

    await step("cashier login goes to POS and must open shift", async () => {
      await cp.goto(`${S}/manage/login`);
      await cp.getByLabel("Email").fill(`cash-${rnd}@example.test`);
      await cp.getByLabel("Password").fill("CashierPass1");
      await cp.getByRole("button", { name: "Sign in" }).click();
      await cp.getByText("Open your shift").first().waitFor();
      if (await cp.getByRole("link", { name: /Products/ }).count()) throw new Error("cashier sees Products");
      await cp.getByLabel("Opening cash in the drawer").fill("1000");
      await cp.getByRole("button", { name: "Open shift" }).click();
      await cp.getByText("Current sale").first().waitFor();
    });

    await step("POS: barcode scan + cash sale", async () => {
      await cp.getByLabel("Scan or search").fill("111222");
      await cp.getByLabel("Scan or search").press("Enter");
      await cp.getByLabel("Scan or search").fill("111222");
      await cp.getByLabel("Scan or search").press("Enter");
      await cp.getByText("Wireless Earbuds").last().waitFor();
      await cp.getByLabel("Cash received").fill("8000");
      await cp.getByText("Change:").first().waitFor();
      await cp.screenshot({ path: `${SHOTS}/11-pos.png` });
      await cp.getByRole("button", { name: "Complete sale" }).click();
      const msg = await cp.getByText(/Sale #\d+ complete/).textContent();
      posNo = msg.match(/#(\d+)/)[1];
      if (!msg.includes("1,000")) throw new Error("unexpected change: " + msg);
    });

    await step("POS refund above limit needs manager PIN", async () => {
      await cp.getByText("↩️ Refund").click();
      await cp.getByPlaceholder("Order #").fill(posNo);
      await cp.getByPlaceholder("Amount").fill("3500");
      await cp.getByRole("button", { name: "Refund cash" }).click();
      await cp.getByText("above your refund limit").first().waitFor();
      await cp.getByPlaceholder("Manager PIN").fill("9999");
      await cp.getByRole("button", { name: "Refund cash" }).click();
      await cp.getByText("didn't match any manager").first().waitFor();
      await cp.getByPlaceholder("Manager PIN").fill("4321");
      await cp.getByRole("button", { name: "Refund cash" }).click();
      await cp.getByText("approved by Mona Manager").first().waitFor();
    });

    await step("close shift report balances", async () => {
      await cp.reload();
      // expected = 1000 + 7000 - 3500 = 4500
      await cp.getByLabel("Counted cash").fill("4500");
      await cp.getByRole("button", { name: "Close shift" }).click();
      await cp.getByText("Shift report").first().waitFor();
      await cp.getByText(/Difference: Rs\s?0/).first().waitFor();
    });

    await step("customer registers, wishlists, reviews", async () => {
      await sp.goto(`${S}/account/register`);
      await sp.getByLabel("Name").fill("Rami Reviewer");
      await sp.getByLabel("Email").fill(`rami-${rnd}@example.test`);
      await sp.getByLabel("Password").fill("ReviewPass1");
      await sp.getByRole("button", { name: "Create account" }).click();
      await sp.getByText("Signed in as").first().waitFor();
      await sp.goto(`${S}/p/wireless-earbuds`);
      await sp.getByRole("button", { name: /Save to wishlist/ }).click();
      await sp.getByRole("button", { name: /Saved to wishlist/ }).waitFor();
      await sp.getByRole("radio", { name: "4 stars" }).click();
      await sp.getByPlaceholder("What did you think?").fill("Great sound!");
      await sp.getByRole("button", { name: "Post review" }).click();
      await sp.getByText("Your review is posted").first().waitFor();
      await sp.goto(`${S}/account`);
      await sp.getByText("Wishlist").first().waitFor();
      await sp.getByRole("link", { name: "Wireless Earbuds" }).waitFor();
    });

    await step("owner turns off accounts: account pages hidden (acceptance 6.3)", async () => {
      await op.goto(`${S}/manage/features`);
      await (await opened(op, "F-22")).click();
      await op.waitForTimeout(2000);
      const r = await sp.goto(`${S}/account`);
      if (r.status() !== 404) throw new Error("account page still visible: " + r.status());
      await op.goto(`${S}/manage/orders/${orderNo}`);
      await op.getByText(`Order #${orderNo}`).first().waitFor();
      await op.goto(`${S}/manage/features`);
      await (await opened(op, "F-22")).click();
      await op.waitForTimeout(1500);
    });

    await step("CSV export", async () => {
      const [status, body] = await op.evaluate(async (u) => { const r = await fetch(u); return [r.status, await r.text()]; }, `${S}/manage/export/orders`);
      if (status !== 200 || !body.includes("number,date") || !body.includes("Sara Shopper")) throw new Error("csv failed " + status);
    });

    await step("cross-tenant isolation: unknown order 404s", async () => {
      const r = await sp.goto(`${S}/order/${orderNo}`); // shopper has no token in this request
      if (r.status() !== 404) throw new Error("order visible without token: " + r.status());
    });

    await step("guide page", async () => {
      await sp.goto(`${BASE}/guide#F-10`);
      await sp.getByText("Tutorials for first-timers").first().waitFor();
      await sp.locator("#F-10").getByText("Needs:").first().waitFor();
    });

    let selfSub = `self-${rnd}`;
    await step("self-serve signup creates a store and opens wizard", async () => {
      const ss = await (await ctx.browser().newContext()).newPage();
      await ss.goto(`${BASE}/?_vercel_share=${SHARE}`);
      await ss.goto(`${BASE}/start`);
      await ss.getByLabel("Store name").fill("Self Serve Store");
      await ss.getByLabel("Store address").fill(selfSub);
      await ss.getByLabel("Your name").fill("Sam Self");
      await ss.getByLabel("Email").fill(`sam-${rnd}@example.test`);
      await ss.getByLabel("Password").fill("SelfServe!234");
      await ss.getByRole("button", { name: /Create my store/ }).click();
      await ss.getByText("Let's get Self Serve Store ready to sell").first().waitFor();
    });

    await step("admin suspends store -> maintenance page; resume", async () => {
      await page.goto(`${BASE}/admin/instances/${storeId}`);
      await page.getByRole("button", { name: /Suspend store/ }).click();
      await page.getByText("This store is suspended").first().waitFor();
      await sp.goto(S);
      await sp.getByText("doing some maintenance").first().waitFor();
      await page.getByRole("button", { name: /Resume store/ }).click();
      await page.waitForTimeout(1500);
      await sp.goto(S);
      await sp.getByRole("heading", { name: "E2E Gadget Shop" }).waitFor();
    });

    await step("admin sees owner activity in audit log", async () => {
      await page.reload();
      await page.getByText("order.status").first().waitFor();
      await page.getByText("staff.add").first().waitFor();
      await page.screenshot({ path: `${SHOTS}/12-admin-instance.png`, fullPage: false });
    });

    await step("delete blocked without export; export then delete both test stores", async () => {
      const { InstanceIds } = { InstanceIds: [storeId] };
      await page.goto(`${BASE}/admin`);
      const selfHref = await page.getByRole("link", { name: "Self Serve Store" }).first().getAttribute("href");
      for (const id of [storeId, selfHref.split("/").pop()]) {
        await page.goto(`${BASE}/admin/instances/${id}`);
        await page.getByText("Delete this store…").click();
        const sub = (await page.getByText(/Type "/).textContent()).match(/"(.+)"/)[1];
        await page.getByLabel(/Type "/).fill(sub);
        await page.getByRole("button", { name: "Delete store permanently" }).click();
        await page.getByText("Download the data export first").first().waitFor();
        const [st, txt] = await page.evaluate(async (u) => { const r = await fetch(u); return [r.status, await r.text()]; }, `${BASE}/admin/instances/${id}/export`);
        if (st !== 200 || !txt.includes('"data"') || txt.includes("passwordHash")) throw new Error("export failed or leaked hashes");
        await page.reload();
        await page.getByText("Delete this store…").click();
        await page.getByLabel(/Type "/).fill(sub);
        await page.getByRole("button", { name: "Delete store permanently" }).click();
        await page.getByText("Welcome back").first().waitFor();
      }
      void InstanceIds;
    });
  } catch {
    // already recorded
  } finally {
    await browser.close();
    const fails = results.filter((r) => r[0] === "FAIL");
    console.log(`\n${results.length - fails.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
  }
})();
