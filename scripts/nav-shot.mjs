import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3000";
await mkdir("/tmp/pl-nav", { recursive: true });

const browser = await chromium.launch({ headless: true });

// Desktop
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await desk.addCookies([
  { name: "pl_age_confirmed", value: "true", url: BASE, sameSite: "Lax" },
]);
const p1 = await desk.newPage();
await p1.goto(`${BASE}/`, { waitUntil: "networkidle" });
await p1.screenshot({
  path: "/tmp/pl-nav/01-nav-desktop.png",
  clip: { x: 0, y: 0, width: 1440, height: 96 },
});
await p1.screenshot({
  path: "/tmp/pl-nav/02-nav-actions-desktop.png",
  clip: { x: 1200, y: 0, width: 240, height: 96 },
});
console.log("✓ desktop shots");

// Mobile (nav + open drawer)
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
await mob.addCookies([
  { name: "pl_age_confirmed", value: "true", url: BASE, sameSite: "Lax" },
]);
const p2 = await mob.newPage();
await p2.goto(`${BASE}/`, { waitUntil: "networkidle" });
await p2.screenshot({
  path: "/tmp/pl-nav/03-nav-mobile.png",
  clip: { x: 0, y: 0, width: 390, height: 96 },
});
await p2.click('[aria-label="Menu"]');
await p2.waitForTimeout(400);
await p2.screenshot({ path: "/tmp/pl-nav/04-nav-mobile-drawer.png", fullPage: false });
console.log("✓ mobile shots");

await browser.close();
