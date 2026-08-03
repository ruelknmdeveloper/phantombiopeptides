/**
 * End-to-end smoke: log in as the test customer on production, then
 * exercise the /account dashboard and /account/orders. Captures
 * screenshots of everything.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "https://www.phantombiopeptides.com";
const EMAIL = process.env.PL_TEST_EMAIL ?? "rcabalunajr+phantomtest@gmail.com";
const PASSWORD = process.env.PL_TEST_PASSWORD ?? "PhantomTest12345!";
const SHOT = "/tmp/pl-authed";
await mkdir(SHOT, { recursive: true });

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const HEADED = process.env.HEADLESS !== "1";
const browser = await chromium.launch({
  headless: !HEADED,
  slowMo: HEADED ? 400 : 0,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([
  { name: "pl_age_confirmed", value: "true", url: BASE, sameSite: "Lax" },
]);
const page = await ctx.newPage();

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push(`console.error: ${m.text()}`);
});

const at = () => new URL(page.url()).pathname;

// 1. Land on /login
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#email", { state: "visible" });
await page.screenshot({ path: `${SHOT}/01-login.png`, fullPage: true });
record("/login renders", at() === "/login");

// 2. Fill + submit
await page.fill("input#email", EMAIL);
await page.fill("input#password", PASSWORD);
await page.click('button:has-text("Sign in")');

// 3. Wait for the redirect to /account (or the streamed redirect to finish)
await page
  .waitForURL(`${BASE}/account`, { timeout: 20000 })
  .catch(() => {});

record("login succeeded → /account", at() === "/account");

// Layout blocks on WP /me round-trip; poll for the actual dashboard chrome
// to appear (up to 20s — WP.com can be slow) before asserting on its shape.
await page
  .waitForFunction(
    () => document.querySelector('button')?.innerText.match(/Sign out/i),
    null,
    { timeout: 20000 },
  )
  .catch(() => {});
await page.screenshot({ path: `${SHOT}/02-account-overview.png`, fullPage: true });

// 4. Dashboard structure
const body = await page.textContent("body");
record("welcome heading with name/email", body.includes("Ruel") || body.includes(EMAIL));
record("sign-out button visible", await page.isVisible('button:has-text("Sign out")'));
record("Orders left-nav link", await page.isVisible('a:has-text("Orders")'));
record("Wishlist left-nav link", await page.isVisible('a:has-text("Wishlist")'));
record("Addresses left-nav link", await page.isVisible('a:has-text("Addresses")'));

// 5. Orders page
await page.click('a:has-text("Orders")');
await page.waitForURL(`${BASE}/account/orders`, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOT}/03-orders.png`, fullPage: true });
record("/account/orders reached", at() === "/account/orders");
const ordersBody = await page.textContent("body");
record(
  "empty-state message shown",
  ordersBody.includes("haven't placed any orders") || ordersBody.includes("No orders"),
);

// 6. Mobile dashboard
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SHOT}/04-account-mobile.png`, fullPage: true });
record("mobile /account still renders", at() === "/account");

// 7. Sign out
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('button:has-text("Sign out")', { timeout: 10000 });
await page.click('button:has-text("Sign out")');
await page.waitForURL(`${BASE}/`, { timeout: 10000 }).catch(() => {});
record("sign out → home", at() === "/");

// 8. /account should redirect back to /login post-signout
await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await page.waitForURL(`${BASE}/login`, { timeout: 10000 }).catch(() => {});
record("post-signout /account → /login", at() === "/login");

console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} passed · ${pageErrors.length} page errors`,
);
if (pageErrors.length) {
  pageErrors.slice(0, 5).forEach((e) => console.log("  ▸", e.slice(0, 300)));
}
console.log(`screenshots: ${SHOT}/*.png`);

await browser.close();
process.exit(results.every((r) => r.ok) && pageErrors.length === 0 ? 0 : 1);
