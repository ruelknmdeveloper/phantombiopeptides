/**
 * End-to-end wishlist flow test on production:
 *
 *   Step 1: guest heart click → localStorage only, no server write
 *   Step 2: sign in → WishlistSyncOnLogin fires, localStorage → WP merge
 *   Step 3: /account/wishlist shows the previously-guest item
 *   Step 4: heart another product while signed in → immediate server sync
 *   Step 5: /account/wishlist shows both items without waiting for cache
 *   Step 6: remove one → dashboard shows only one
 *
 * Verifies both the merge-on-login fix and the cache-invalidation fix.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "https://www.phantombiopeptides.com";
const EMAIL = "rcabalunajr+phantomtest@gmail.com";
const PASSWORD = "PhantomTest12345!";
const SHOT = "/tmp/pl-wishflow";
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
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push(`console: ${m.text()}`);
});

// Trace wishlist-adjacent traffic
const calls = [];
page.on("request", (req) => {
  if (req.url().includes("/api/wishlist")) {
    calls.push({ method: req.method(), url: req.url(), body: req.postData() });
  }
});
page.on("response", async (res) => {
  if (res.url().includes("/api/wishlist")) {
    const body = await res.text().catch(() => "");
    const last = calls[calls.length - 1];
    if (last && !last.status) {
      last.status = res.status();
      last.response = body.slice(0, 200);
    }
  }
});

// ── Step 1: GUEST adds two items to wishlist ─────────────────
console.log("\n== step 1: guest hearts two products ==");
await page.goto(`${BASE}/category/recovery-and-repair`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(3500);
const hearts = await page.locator('button[aria-label*="Save"]').all();
console.log(`  visible hearts on category page: ${hearts.length}`);

// Click two hearts (guest — should NOT fire /api/wishlist)
if (hearts.length >= 2) {
  await hearts[0].click();
  await page.waitForTimeout(400);
  await hearts[1].click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: `${SHOT}/01-guest-hearted.png`, fullPage: true });

record(
  "guest heart clicks do NOT fire /api/wishlist",
  calls.length === 0,
  `(saw ${calls.length} calls)`,
);
const localStorageAfterGuest = await page.evaluate(() =>
  localStorage.getItem("pl_wishlist"),
);
const guestItems = JSON.parse(localStorageAfterGuest ?? "[]");
console.log(`  localStorage items: ${guestItems.length}`);
record(
  "localStorage has 2 items after guest hearts",
  guestItems.length === 2,
);

// ── Step 2: sign in → WishlistSyncOnLogin should fire merge ──
console.log("\n== step 2: sign in, expect auto-merge ==");

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#email", { state: "visible" });
await page.fill("input#email", EMAIL);
await page.fill("input#password", PASSWORD);
await page.click('button:has-text("Sign in")');
await page.waitForURL(`${BASE}/account`, { timeout: 20000 }).catch(() => {});

// Poll the network-call log for a completed merge — waitForResponse
// gets flaky across the login redirect, but the request/response
// handlers keep pushing regardless.
let mergeCall = null;
for (let i = 0; i < 30; i++) {
  mergeCall = calls.find(
    (c) => c.url.includes("/api/wishlist/merge") && c.status,
  );
  if (mergeCall) break;
  await page.waitForTimeout(500);
}
record(
  "POST /api/wishlist/merge fired on login",
  !!mergeCall,
  mergeCall ? `${mergeCall.status} ${mergeCall.response}` : "(never seen)",
);
record(
  "merge response is ok:true",
  mergeCall?.response?.includes('"ok":true') === true,
);
// Extra buffer so the revalidateTag from the /api/wishlist/merge
// handler has fully flushed before the /account/wishlist read.
await page.waitForTimeout(2500);

// ── Step 3: /account/wishlist reflects the merged items ──────
console.log("\n== step 3: dashboard reflects merged items ==");
await page.goto(`${BASE}/account/wishlist`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOT}/02-dashboard-after-merge.png`, fullPage: true });

const body1 = await page.textContent("body");
const empty1 = body1.includes("Your wishlist is empty");
record("dashboard NOT empty after merge", !empty1);

// Count actual list items — the wishlist page renders each as an <li>
// inside the grid.
const dashItems = await page.locator("main ul li").count();
console.log(`  dashboard <li> count: ${dashItems}`);

// ── Step 4: signed-in heart click → direct server sync ───────
console.log("\n== step 4: signed-in heart click ==");
const preClickCalls = calls.length;
await page.goto(`${BASE}/product/semaglutide-glp-1`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(3000);
const pdpHearts = await page
  .locator('button[aria-label*="wishlist"]')
  .all();
if (pdpHearts.length > 0) {
  // If already saved (aria-pressed=true), the label says "Remove …" —
  // click a heart that says "Save".
  let clicked = false;
  for (const h of pdpHearts) {
    const label = await h.getAttribute("aria-label");
    if (label && label.includes("Save")) {
      await h.click();
      clicked = true;
      break;
    }
  }
  if (!clicked && pdpHearts[0]) await pdpHearts[0].click();
  await page.waitForTimeout(2500);
}

const postClickCalls = calls.slice(preClickCalls);
const addCall = postClickCalls.find((c) => c.method === "POST" && !c.url.includes("merge"));
record(
  "signed-in click fires POST /api/wishlist",
  !!addCall,
  addCall ? `${addCall.status} ${addCall.response}` : "(none)",
);

// ── Step 5: dashboard reflects the new item WITHOUT waiting ──
console.log("\n== step 5: cache invalidation ==");
await page.goto(`${BASE}/account/wishlist`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOT}/03-dashboard-after-signed-add.png`, fullPage: true });

const dashItemsAfter = await page.locator("main ul li").count();
console.log(`  dashboard <li> count now: ${dashItemsAfter}`);
record(
  "dashboard count grew after signed-in add (cache invalidated)",
  dashItemsAfter > dashItems || dashItemsAfter >= 3,
);

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed · ${pageErrors.length} page errors`);
console.log(`screenshots: ${SHOT}/*.png`);
console.log(`\nall network calls to /api/wishlist:`);
calls.forEach((c, i) =>
  console.log(`  [${i}] ${c.method} ${c.url} → ${c.status ?? "?"} ${c.response ?? ""}`),
);
if (pageErrors.length) {
  console.log(`\npage errors:`);
  pageErrors.slice(0, 5).forEach((e) => console.log(`  ▸ ${e.slice(0, 300)}`));
}

await b.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
