/**
 * Smoke test for the standalone quiz landing page. Loads the file from
 * disk (as if Keanu's Vercel is serving it), intercepts POSTs to
 * phantombiopeptides.com/api/quiz-lead, and walks the whole flow.
 *
 *   node scripts/quiz-standalone-smoke.mjs
 */

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const FILE = path.resolve("deliverables/quiz-landing/index.html");
const SHOT = "/tmp/pl-quiz-standalone";
await mkdir(SHOT, { recursive: true });

const results = [];
const record = (name, ok) => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

// Intercept the production API — Keanu's deploy will hit this in real life.
const leadPayloads = [];
await ctx.route("**/www.phantombiopeptides.com/api/quiz-lead", async (route) => {
  const req = route.request();
  const body = req.postDataJSON();
  leadPayloads.push(body);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      ok: true,
      pdf_url: "https://phantombiopeptides.com/wp-content/uploads/2026/07/phantom-researchers-field-guide.pdf",
    }),
  });
});

// Load from file:// — no server, mimics how Vercel will serve static HTML.
await page.goto(pathToFileURL(FILE).href, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#firstName", { state: "visible" });
await page.screenshot({ path: `${SHOT}/01-contact.png`, fullPage: true });
record("contact step renders", true);
record(
  "no age gate visible",
  !(await page.locator('[aria-labelledby="age-gate-title"]').isVisible().catch(() => false)),
);

// Fill contact
await page.fill("input#firstName", "Alex");
await page.fill("input#phone", "4155550119");
await page.fill("input#email", "smoke@example.com");
await page.click('button:has-text("Start the quiz")');
await page.waitForTimeout(400);

record("started POST fired", leadPayloads.length === 1);
if (leadPayloads.length) {
  const p = leadPayloads[0];
  record("started stage correct", p.stage === "started");
  record("started email correct", p.email === "smoke@example.com");
  record("started name correct", p.first_name === "Alex");
}

record(
  "question 1 rendered",
  (await page.textContent("body")).includes("Question 1 of 5"),
);
await page.screenshot({ path: `${SHOT}/02-q1.png`, fullPage: true });

// Walk all 5 questions — first option each time.
for (let i = 1; i <= 5; i++) {
  await page.click(".opt");
  await page.waitForTimeout(120);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(180);
}
record(
  "consent step reached",
  (await page.textContent("body")).includes("free guide"),
);
await page.screenshot({ path: `${SHOT}/03-consent.png`, fullPage: true });

// Consent + submit
await page.click("input#consent");
await page.click('button:has-text("Send my guide")');
await page.waitForTimeout(500);

record("completed POST fired", leadPayloads.length === 2);
if (leadPayloads.length >= 2) {
  const p = leadPayloads[1];
  record("completed stage correct", p.stage === "completed");
  record("consent flag true", p.consent === true);
  record("5 answers captured", Array.isArray(p.answers) && p.answers.length === 5);
  record(
    "q3 (multi) is an array",
    Array.isArray(p.answers[2]?.answer),
  );
}

record(
  "done screen shows",
  (await page.textContent("body")).includes("You’re all set"),
);
// Wait for PDF poll to populate
await page.waitForTimeout(500);
record(
  "PDF download button visible",
  await page.isVisible('a:has-text("Download the guide now")'),
);
await page.screenshot({ path: `${SHOT}/04-done.png`, fullPage: true });

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed · ${errors.length} page errors`);
if (errors.length) errors.slice(0, 5).forEach((e) => console.log("  ▸", e.slice(0, 200)));
console.log(`screenshots: ${SHOT}/*.png`);

await browser.close();
process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1);
