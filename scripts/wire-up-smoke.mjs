/**
 * Verify the three connections on production:
 *   1. pl_signed_in cookie set on login
 *   2. Checkout page prefilled when signed in
 *   3. Wishlist button → server sync when signed in
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "https://www.phantombiopeptides.com";
const EMAIL = "rcabalunajr+phantomtest@gmail.com";
const PASSWORD = "PhantomTest12345!";
const SHOT = "/tmp/pl-wire";
await mkdir(SHOT, { recursive: true });

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([
  { name: "pl_age_confirmed", value: "true", url: BASE, sameSite: "Lax" },
]);
const page = await ctx.newPage();

// ── 1. Login → check pl_signed_in cookie set ──────────────────
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#email", { state: "visible" });
await page.fill("input#email", EMAIL);
await page.fill("input#password", PASSWORD);
await page.click('button:has-text("Sign in")');
await page.waitForURL(`${BASE}/account`, { timeout: 20000 }).catch(() => {});

const cookies = await ctx.cookies(BASE);
const hint = cookies.find((c) => c.name === "pl_signed_in");
record("pl_signed_in hint cookie set on login", hint?.value === "1");
record("pl_session cookie set on login", !!cookies.find((c) => c.name === "pl_session"));
record(
  "hint cookie NOT httpOnly (readable by JS)",
  hint ? hint.httpOnly === false : false,
);

// ── 2. Checkout prefill ──────────────────────────────────────
// Add a real product to cart via a PDP (shop listing doesn't have a
// direct-add button).
await page.goto(`${BASE}/product/semaglutide-glp-1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(3000);
// Try various common add-to-cart button selectors.
const addSelectors = [
  'button:has-text("Add to cart")',
  'button:has-text("Add to Cart")',
  'button:has-text("Add to bag")',
];
for (const sel of addSelectors) {
  const btn = page.locator(sel).first();
  if ((await btn.count()) > 0) {
    await btn.click().catch(() => {});
    break;
  }
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOT}/00-pdp-added.png`, fullPage: true });

await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOT}/01-checkout-prefill.png`, fullPage: true });

const emailVal =
  (await page.inputValue("input#email").catch(() => "")) ?? "";
const firstNameVal =
  (await page.inputValue("input#first_name").catch(() => "")) ?? "";

record(
  "checkout email prefilled",
  (emailVal ?? "").trim().toLowerCase() === EMAIL.toLowerCase(),
  `got "${emailVal}"`,
);
record(
  "checkout first_name prefilled",
  (firstNameVal ?? "").trim().length > 0,
  `got "${firstNameVal}"`,
);

// ── 3. Wishlist button on a PDP calls /api/wishlist ───────────
// Intercept the sync call.
let wishlistPost = 0;
await page.route("**/api/wishlist", async (route) => {
  wishlistPost++;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true }),
  });
});

// Land on any PDP.
await page.goto(`${BASE}/product/semaglutide-glp-1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(2500);
const wishBtn = page.locator('button[aria-label="Add to wishlist"]').first();
const hasWishBtn = await wishBtn.count();
record("wishlist heart button present on PDP", hasWishBtn > 0);

if (hasWishBtn) {
  await wishBtn.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOT}/02-pdp-wishlist.png`, fullPage: true });
  record("wishlist add → sync fired", wishlistPost >= 1);

  // Toggle off (the button's aria-label changed after add)
  const removeBtn = page
    .locator('button[aria-label="Remove from wishlist"]')
    .first();
  await removeBtn.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  await removeBtn.click().catch(() => {});
  await page.waitForTimeout(1200);
  record("wishlist remove → sync fired (2nd call)", wishlistPost >= 2);
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
console.log(`screenshots: ${SHOT}/*.png`);

await b.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
