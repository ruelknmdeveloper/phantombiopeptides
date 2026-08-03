/**
 * Playwright smoke for /login on backup-full-work (the accounts branch).
 * Not currently on production — this verifies the code we'll ship once
 * the JWT plugin is on WordPress and the branch is merged to main.
 *
 *   node scripts/login-smoke.mjs
 *   HEADLESS=1 node scripts/login-smoke.mjs
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOT = "/tmp/pl-login";
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
const bodyContains = async (needle) =>
  (await page.textContent("body")).includes(needle);

// 1. Route renders + basic structure
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#email", { state: "visible" });
await page.screenshot({ path: `${SHOT}/01-login.png`, fullPage: true });

record("/login renders (200)", at() === "/login");
record("email input present", await page.isVisible("input#email"));
record("password input present", await page.isVisible("input#password"));
record(
  "email autocomplete=email",
  (await page.getAttribute("input#email", "autocomplete")) === "email",
);
record(
  "password autocomplete=current-password",
  (await page.getAttribute("input#password", "autocomplete")) ===
    "current-password",
);
record(
  "forgot-password link → /account/reset",
  (await page.getAttribute('a:has-text("Forgot password?")', "href")) ===
    "/account/reset",
);
record(
  "no email-link tab (password only)",
  !(await page.getByRole("button", { name: /email link/i }).count()),
);
record("brand-styled 'Welcome back' headline", await bodyContains("Welcome back"));
record("secure sign-in eyebrow", await bodyContains("Secure sign-in"));

// 2. Show/hide password toggle
const passwordType0 = await page.getAttribute("input#password", "type");
await page.click('button[aria-label="Show password"]');
await page.waitForTimeout(100);
const passwordType1 = await page.getAttribute("input#password", "type");
await page.click('button[aria-label="Hide password"]');
await page.waitForTimeout(100);
const passwordType2 = await page.getAttribute("input#password", "type");
record(
  "show/hide password toggle works",
  passwordType0 === "password" &&
    passwordType1 === "text" &&
    passwordType2 === "password",
);

// 3. Bad password → generic error (no enumeration)
await page.fill("input#email", "smoke-test@example.com");
await page.fill("input#password", "wrong-password-xyz");
await page.click('button:has-text("Sign in")');
// Wait for the JWT round-trip to WordPress + React to render the error.
// Prod WP.com round-trips can take 3–5s; poll for the error text instead
// of a fixed sleep.
await page
  .waitForFunction(
    () => document.body.innerText.includes("Invalid email or password"),
    null,
    { timeout: 15000 },
  )
  .catch(() => {});
record(
  "bad password → generic 'Invalid email or password'",
  await bodyContains("Invalid email or password"),
);
await page.screenshot({ path: `${SHOT}/02-login-bad-password.png`, fullPage: true });

// 4. Mobile viewport
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#email", { state: "visible" });
await page.screenshot({ path: `${SHOT}/03-login-mobile.png`, fullPage: true });
record(
  "/login renders on 390px viewport",
  await page.isVisible("input#email"),
);

// 5. Auth-gated route redirects to /login (via proxy)
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await page.waitForURL(`${BASE}/login`, { timeout: 8000 }).catch(() => {});
record("/account (no session) → /login", at() === "/login");

// Summary
console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} passed · ${pageErrors.length} page errors`,
);
if (pageErrors.length) {
  pageErrors.slice(0, 5).forEach((e) => console.log("  ▸", e.slice(0, 300)));
}
console.log(`screenshots: ${SHOT}/*.png`);

await browser.close();
process.exit(
  results.every((r) => r.ok) && pageErrors.length === 0 ? 0 : 1,
);
