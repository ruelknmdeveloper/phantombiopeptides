/**
 * Quiz-only smoke: verify /quiz renders standalone, walks the full
 * flow, and posts to /api/quiz-lead at both stages. Intercepts the
 * lead endpoint so it can run without a live WordPress.
 *
 *   node scripts/quiz-smoke.mjs                 # headed, watch it browse
 *   HEADLESS=1 node scripts/quiz-smoke.mjs      # CI
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOT = "/tmp/pl-quiz";
await mkdir(SHOT, { recursive: true });

const results = [];
const record = (name, ok) => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}`);
};

const HEADED = process.env.HEADLESS !== "1";
const browser = await chromium.launch({
  headless: !HEADED,
  slowMo: HEADED ? 300 : 0,
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

// Intercept the lead endpoint so we can smoke without WordPress.
let leadCalls = 0;
await ctx.route("**/api/quiz-lead", async (route) => {
  leadCalls++;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, pdf_url: "https://example.com/guide.pdf" }),
  });
});

async function shot(name) {
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
}
const at = () => new URL(page.url()).pathname;

// Route + chrome
await page.goto(`${BASE}/quiz`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#firstName", { state: "visible" });
await shot("01-contact");
record("/quiz renders", at() === "/quiz");
record(
  "no site navbar",
  !(await page.getByRole("link", { name: "Products" }).count()),
);
record(
  "no site footer",
  !(await (await page.textContent("body")).includes("Research use policy")),
);
record(
  "standalone logo + trust strip",
  (await page.textContent("body")).includes("HPLC verified"),
);

// Storefront regression on a couple of unrelated pages.
for (const path of ["/", "/shop", "/checkout"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  record(`${path} still renders`, Boolean(await page.title()));
}

// Full walk-through
await page.goto(`${BASE}/quiz`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#firstName", { state: "visible" });
await page.fill("input#firstName", "Alex");
await page.fill("input#phone", "4155550119");
await page.fill("input#email", "smoke@example.com");
await page.click('button:has-text("Start the quiz")');
await page.waitForTimeout(400);
record("started POST fired", leadCalls === 1);
record(
  "question 1 rendered",
  (await page.textContent("body")).includes("Question 1 of 5"),
);
await shot("02-question-1");

for (let i = 1; i <= 5; i++) {
  const opts = await page.$$("button:has(span.text-sm)");
  await opts[0].click();
  await page.waitForTimeout(150);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(200);
}
record(
  "consent step reached",
  (await page.textContent("body")).includes("free guide"),
);
await shot("03-consent");

await page.click('input[type="checkbox"]');
await page.click('button:has-text("Send my guide")');
await page.waitForTimeout(500);
record("completed POST fired", leadCalls === 2);
record(
  "done step shown",
  (await page.textContent("body")).includes("You're all set"),
);
record(
  "PDF download link visible",
  await page.isVisible('a:has-text("Download the guide now")'),
);
await shot("04-done");

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed · ${pageErrors.length} page errors`);
if (pageErrors.length) {
  pageErrors.slice(0, 5).forEach((e) => console.log("  ▸", e.slice(0, 300)));
}
console.log(`screenshots: ${SHOT}/*.png`);

await browser.close();
process.exit(
  results.every((r) => r.ok) && pageErrors.length === 0 ? 0 : 1,
);
