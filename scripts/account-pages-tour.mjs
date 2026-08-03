/**
 * Tour every left-nav link on /account/* and report:
 *   - HTTP status
 *   - Final URL (in case of redirect)
 *   - Whether "reconstituted" 404 text appears
 *   - Screenshot per page
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "https://www.phantombiopeptides.com";
const EMAIL = "rcabalunajr+phantomtest@gmail.com";
const PASSWORD = "PhantomTest12345!";
const SHOT = "/tmp/pl-account-tour";
await mkdir(SHOT, { recursive: true });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([
  { name: "pl_age_confirmed", value: "true", url: BASE, sameSite: "Lax" },
]);
const page = await ctx.newPage();

// Login
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("input#email", { state: "visible" });
await page.fill("input#email", EMAIL);
await page.fill("input#password", PASSWORD);
await page.click('button:has-text("Sign in")');
await page.waitForURL(`${BASE}/account`, { timeout: 20000 }).catch(() => {});
await page.waitForFunction(
  () => document.querySelector('button')?.innerText.match(/Sign out/i),
  null,
  { timeout: 20000 },
).catch(() => {});
console.log(`signed in — now on ${new URL(page.url()).pathname}\n`);

const routes = [
  { path: "/account",               label: "Overview" },
  { path: "/account/orders",        label: "Orders" },
  { path: "/account/wishlist",      label: "Wishlist" },
  { path: "/account/addresses",     label: "Addresses" },
  { path: "/account/profile",       label: "Profile" },
  { path: "/account/notifications", label: "Notifications" },
  { path: "/account/security",      label: "Security" },
  { path: "/account/support",       label: "Support" },
];

console.log("nav-label       path                          status  final-url                  notes");
console.log("─".repeat(120));

for (const r of routes) {
  // waitUntil: "domcontentloaded" so the response is bound; then poll for
  // the layout chrome to indicate a full render (works for both real pages
  // and the reconstituted-not-found page).
  const resp = await page
    .goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded" })
    .catch(() => null);
  const status = resp ? resp.status() : "n/a";
  await page.waitForTimeout(2500); // let it settle

  const finalPath = new URL(page.url()).pathname;
  const body = (await page.textContent("body")) ?? "";

  const notes = [];
  // The peptide-branded 404 uses a specific headline. "reconstituted"
  // as a bare word appears in marketing copy on every page, so match
  // the full phrase.
  if (body.includes("This page has been reconstituted"))
    notes.push("BRANDED_404");
  if (finalPath !== r.path)
    notes.push(`redirected → ${finalPath}`);
  if (status >= 400)
    notes.push(`http ${status}`);

  console.log(
    `${r.label.padEnd(15)} ${r.path.padEnd(30)} ${String(status).padEnd(7)} ${finalPath.padEnd(26)} ${notes.join(", ") || "renders"}`,
  );

  await page.screenshot({
    path: `${SHOT}/${r.path.replace(/\//g, "_") || "root"}.png`,
    fullPage: true,
  });
}

console.log(`\nscreenshots: ${SHOT}/*.png`);
await b.close();
