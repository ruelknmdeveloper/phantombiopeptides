/**
 * End-to-end smoke test for the customer-account MVP.
 *
 * Usage:  node scripts/account-smoke.mjs
 * Assumes the dev server is running at http://localhost:3000.
 * Screenshots land in /tmp/pl-smoke/*.png.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOT = "/tmp/pl-smoke";
await mkdir(SHOT, { recursive: true });

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// Headed by default so you can watch it browse. Pass HEADLESS=1 for CI.
const HEADED = process.env.HEADLESS !== "1";
const browser = await chromium.launch({
  headless: !HEADED,
  slowMo: HEADED ? 400 : 0,
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
// Age-gate bypass — the peptides site blocks all interactions until this.
await ctx.addCookies([
  { name: "pl_age_confirmed", value: "true", url: BASE, sameSite: "Lax" },
]);
const page = await ctx.newPage();

const pageErrors = [];
page.on("pageerror", (e) => {
  pageErrors.push(`${at()} :: ${String(e)}\n${e.stack ?? ""}`);
});
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push(`${at()} :: console.error: ${m.text()}`);
});

const shot = (name) => page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
const at = () => new URL(page.url()).pathname;
const bodyContains = async (needle) => (await page.textContent("body")).includes(needle);

// ─────────────────────────────────────────────────────────────
// 1. Route guards
// ─────────────────────────────────────────────────────────────
console.log("\n── Route guards ──");
const routes = [
  { from: "/",                     expect: "/",              gated: false },
  { from: "/shop",                 expect: "/shop",          gated: false },
  { from: "/checkout",             expect: "/checkout",      gated: false },
  { from: "/login",                expect: "/login",         gated: false },
  { from: "/account/setup",        expect: "/account/setup", gated: false },
  { from: "/account/reset",        expect: "/account/reset", gated: false },
  { from: "/account/verify",       expect: "/account/verify",gated: false },
  { from: "/quiz",                 expect: "/quiz",          gated: false },
  { from: "/account",              expect: "/login",         gated: true  },
  { from: "/account/orders",       expect: "/login",         gated: true  },
];
for (const r of routes) {
  await page.goto(`${BASE}${r.from}`, { waitUntil: "domcontentloaded" });
  if (r.from !== r.expect) {
    // Streaming redirects land after DOMContentLoaded. Wait for the
    // client SDK to finish following the NEXT_REDIRECT.
    await page
      .waitForURL(`${BASE}${r.expect}`, { timeout: 8000 })
      .catch(() => {});
  }
  const finalPath = at();
  const ok = finalPath === r.expect;
  record(
    `${r.gated ? "GATED " : "PUBLIC"} ${r.from.padEnd(22)} → ${finalPath}`,
    ok,
    ok ? "" : `expected ${r.expect}`,
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Login page UI
// ─────────────────────────────────────────────────────────────
console.log("\n── /login UI ──");
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await shot("01-login-password");

record(
  "email + password fields render",
  (await page.isVisible('input#email')) && (await page.isVisible('input#password')),
);
record(
  "forgot-password link points to /account/reset",
  (await page.getAttribute('a:has-text("Forgot password?")', "href")) === "/account/reset",
);
record(
  "email input has autocomplete=email",
  (await page.getAttribute('input#email', "autocomplete")) === "email",
);
record(
  "password input has autocomplete=current-password",
  (await page.getAttribute('input#password', "autocomplete")) === "current-password",
);
record(
  "no email-link tab (password only)",
  !(await page.getByRole("button", { name: /email link/i }).count()),
);

// ─────────────────────────────────────────────────────────────
// 3. Auth form actions — all should fail gracefully because the WP
//    plugin is not yet installed. What matters: no stack traces, no
//    enumeration, no page-error events.
// ─────────────────────────────────────────────────────────────
console.log("\n── Auth form actions ──");

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input#email', 'smoke-test@example.com');
await page.fill('input#password', 'wrong-password-xyz');
await page.click('button:has-text("Sign in")');
await page.waitForTimeout(1500);
record(
  "bad password → generic error",
  await bodyContains("Invalid email or password"),
);
await shot("03-login-bad-password");

await page.goto(`${BASE}/account/reset`, { waitUntil: "domcontentloaded" });
await page.fill('input#email', 'smoke-test@example.com');
await page.click('button:has-text("Send reset link")');
await page.waitForTimeout(1500);
record(
  "reset request → generic ack",
  await bodyContains("reset link is on the way"),
);
await shot("05-reset-request-ack");

await page.goto(`${BASE}/account/setup?token=invalidtoken1234567890abcdef1234567890`, { waitUntil: "domcontentloaded" });
await page.fill('input#password', 'sufficientlylongpw123');
await page.fill('input#confirm', 'sufficientlylongpw123');
await page.click('button:has-text("Set password")');
await page.waitForTimeout(1500);
record(
  "set-password (bad token) → error surfaced",
  (await bodyContains("invalid")) || (await bodyContains("expired")) || (await bodyContains("Something went wrong")),
);
await shot("06-setup-bad-token");

await page.goto(`${BASE}/account/setup?token=validlookingtoken1234567890abcdef12`, { waitUntil: "domcontentloaded" });
await page.fill('input#password', 'longenoughpassword1');
await page.fill('input#confirm', 'different-password-xyz');
await page.click('button:has-text("Set password")');
await page.waitForTimeout(500);
record(
  "set-password mismatch → client-side error",
  await bodyContains("don't match") || await bodyContains("don’t match"),
);
await shot("07-setup-mismatch");

await page.goto(`${BASE}/account/verify?token=bogustoken1234567890abcdef1234567890`, { waitUntil: "domcontentloaded" });
record(
  "verify-email (bad token) → error, no crash",
  await bodyContains("couldn't verify") || await bodyContains("invalid") || await bodyContains("expired"),
);
await shot("09-verify-bad-token");

// ─────────────────────────────────────────────────────────────
// 3b. /quiz — funnel walk-through.
// ─────────────────────────────────────────────────────────────
console.log("\n── /quiz flow ──");

// Intercept /api/quiz-lead so we can smoke without a live WP.
let leadCalls = 0;
await ctx.route("**/api/quiz-lead", async (route) => {
  leadCalls++;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, pdf_url: "https://example.com/guide.pdf" }),
  });
});

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/quiz`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input#firstName', { state: "visible" });
await shot("q1-contact");
record("/quiz renders contact step", await bodyContains("60-second"));
record(
  "/quiz hides site navbar",
  !(await page.getByRole("link", { name: "Products" }).count()),
);
record(
  "/quiz hides site footer",
  !(await bodyContains("Research use policy")),
);
record(
  "/quiz keeps standalone logo + trust strip",
  await bodyContains("HPLC verified"),
);

// Fill contact + start
await page.fill("input#firstName", "Alex");
await page.fill("input#phone", "4155550119");
await page.fill("input#email", "smoke-test@example.com");
await page.click('button:has-text("Start the quiz")');
await page.waitForTimeout(400);
record("started POST fired", leadCalls === 1);
record("question 1 rendered", await bodyContains("Question 1 of 5"));
await shot("q2-question-1");

// Walk each question — click first option, next.
for (let i = 1; i <= 5; i++) {
  const opts = await page.$$('button:has(span.text-sm)');
  await opts[0].click();
  await page.waitForTimeout(150);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(250);
}
record("consent step rendered", await bodyContains("free guide"));
await shot("q3-consent");

// Consent + submit
await page.click('input[type="checkbox"]');
await page.click('button:has-text("Send my guide")');
await page.waitForTimeout(600);
record("completed POST fired", leadCalls === 2);
record("done step shown", await bodyContains("You're all set"));
record(
  "PDF download link visible",
  await page.isVisible('a:has-text("Download the guide now")'),
);
await shot("q4-done");

await ctx.unroute("**/api/quiz-lead");

// ─────────────────────────────────────────────────────────────
// 4. Storefront regressions — the pre-existing pages must still work.
// ─────────────────────────────────────────────────────────────
console.log("\n── Storefront regression ──");
for (const path of ["/", "/shop", "/checkout"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  const title = await page.title();
  record(`${path.padEnd(10)} renders (title="${title.slice(0, 40)}")`, Boolean(title));
}
await shot("10-home");

// ─────────────────────────────────────────────────────────────
// 5. Mobile viewport smoke
// ─────────────────────────────────────────────────────────────
console.log("\n── Mobile viewport ──");
await page.setViewportSize({ width: 390, height: 844 }); // iPhone 13/14
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
record(
  "/login renders on 390px viewport",
  await page
    .waitForSelector('input#email', { state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false),
);
await shot("11-login-mobile");

await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await page.waitForURL(`${BASE}/login`, { timeout: 8000 }).catch(() => {});
record(
  "/account (mobile) still redirects to /login",
  at() === "/login",
);

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log(`\n── Summary ──`);
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`${pass}/${results.length} passed · ${fail} failed · ${pageErrors.length} page errors`);
if (fail) {
  console.log("\nfailures:");
  results.filter((r) => !r.ok).forEach((r) => console.log("  ✗", r.name, r.detail));
}
if (pageErrors.length) {
  console.log("\npage errors:");
  pageErrors.slice(0, 10).forEach((e) => {
    console.log("  ▸", e);
    console.log("---");
  });
}
console.log(`\nscreenshots: ${SHOT}/*.png`);

await browser.close();
process.exit(fail === 0 && pageErrors.length === 0 ? 0 : 1);
