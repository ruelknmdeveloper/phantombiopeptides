/**
 * Render the customer dashboard against a stub WP server so we can see
 * what the pages look like before the real WordPress plugin is live.
 *
 *   node scripts/dashboard-preview.mjs
 *
 * Spins up:
 *   1. A tiny mock WP on :3333 answering /wp-json/phantom/v1/me and
 *      /wp-json/wc/v3/orders (that's everything the account routes need).
 *   2. Next dev on :3000 with WC_STORE_URL pointed at the mock and
 *      JWT_AUTH_SECRET_KEY set so getSession() can verify the cookie.
 *   3. Playwright — mints a matching HS256 JWT, sets the pl_session
 *      cookie, navigates the dashboard, captures screenshots.
 *
 * Screenshots land in /tmp/pl-dash/*.png.
 */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";

const SECRET = "preview-secret-not-for-prod-1234567890";
const USER_ID = 42;
const MOCK_PORT = 3333;
const NEXT_PORT = 3000;
const SHOT = "/tmp/pl-dash";

await mkdir(SHOT, { recursive: true });

// ── 1. Mock WordPress ─────────────────────────────────────────
const mock = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${MOCK_PORT}`);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (url.pathname === "/wp-json/phantom/v1/me") {
    res.end(JSON.stringify({
      id: USER_ID,
      email: "alex.chen@example.com",
      first_name: "Alex",
      last_name: "Chen",
      display_name: "Alex Chen",
      email_verified_at: "2026-07-15T10:14:00Z",
      phone: "+1 415 555 0119",
      birthday: null,
      preferred_language: "en",
      marketing_consent: true,
      billing: {
        first_name: "Alex", last_name: "Chen",
        address_1: "742 Evergreen Terrace", city: "San Francisco",
        state: "CA", postcode: "94110", country: "US",
        email: "alex.chen@example.com", phone: "+1 415 555 0119",
      },
      shipping: {
        first_name: "Alex", last_name: "Chen",
        address_1: "742 Evergreen Terrace", city: "San Francisco",
        state: "CA", postcode: "94110", country: "US",
      },
    }));
    return;
  }

  if (url.pathname === "/wp-json/wc/v3/orders") {
    // A believable order history: one in-flight, two delivered, then older.
    res.setHeader("X-WP-Total", "5");
    res.setHeader("X-WP-TotalPages", "1");
    res.end(JSON.stringify([
      {
        id: 10428, number: "10428", status: "processing",
        date_created: "2026-07-25T10:14:00", total: "412.00",
        currency: "USD", customer_id: USER_ID,
        line_items: [{ name: "GHK-Cu 50mg" }, { name: "GLP-3 (Rt) 5mg" }],
      },
      {
        id: 10391, number: "10391", status: "completed",
        date_created: "2026-07-12T14:22:00", total: "189.00",
        currency: "USD", customer_id: USER_ID,
        line_items: [{ name: "BPC-157 5mg" }, { name: "TB-500 5mg" }],
      },
      {
        id: 10344, number: "10344", status: "completed",
        date_created: "2026-06-30T09:07:00", total: "612.00",
        currency: "USD", customer_id: USER_ID,
        line_items: [
          { name: "Semaglutide 5mg" }, { name: "Tirzepatide 10mg" },
          { name: "Retatrutide 10mg" }, { name: "Bacteriostatic Water" },
        ],
      },
      {
        id: 10201, number: "10201", status: "completed",
        date_created: "2026-05-14T18:44:00", total: "245.00",
        currency: "USD", customer_id: USER_ID,
        line_items: [{ name: "Ipamorelin 5mg" }, { name: "CJC-1295 5mg" }],
      },
      {
        id: 10087, number: "10087", status: "completed",
        date_created: "2026-04-02T11:30:00", total: "158.00",
        currency: "USD", customer_id: USER_ID,
        line_items: [{ name: "GHK-Cu 50mg" }],
      },
    ]));
    return;
  }

  if (url.pathname.startsWith("/wp-json/wc/v3/categories") ||
      url.pathname.startsWith("/wp-json/wc/v3/products")) {
    // Root layout may prefetch categories — return empty rather than 404.
    res.setHeader("X-WP-Total", "0");
    res.setHeader("X-WP-TotalPages", "1");
    res.end("[]");
    return;
  }

  res.statusCode = 404;
  res.end("{}");
});
await new Promise((r) => mock.listen(MOCK_PORT, r));
console.log(`✓ mock WP listening on :${MOCK_PORT}`);

// ── 2. Next dev with env pointed at the mock ──────────────────
const next = spawn("npm", ["run", "dev"], {
  env: {
    ...process.env,
    NEXT_PUBLIC_USE_MOCKS: "false",
    WC_STORE_URL: `http://localhost:${MOCK_PORT}`,
    WC_CONSUMER_KEY: "preview-key",
    WC_CONSUMER_SECRET: "preview-secret",
    JWT_AUTH_SECRET_KEY: SECRET,
  },
  stdio: "pipe",
});
next.stdout.on("data", (b) => {
  const s = b.toString();
  if (/ready|error/i.test(s)) process.stdout.write(`[next] ${s}`);
});
next.stderr.on("data", (b) => process.stderr.write(`[next!] ${b}`));

// Wait for Next to accept requests.
await new Promise(async (resolve, reject) => {
  const t = setTimeout(() => reject(new Error("next dev never started")), 30_000);
  while (true) {
    try {
      const r = await fetch(`http://localhost:${NEXT_PORT}/`);
      if (r.ok) { clearTimeout(t); resolve(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
});
console.log(`✓ next dev up on :${NEXT_PORT}`);

// ── 3. Mint a HS256 JWT the way our /lib/wp-auth.ts expects ────
function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function mintJwt(userId, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: "http://localhost:3333",
    iat: now, nbf: now, exp: now + 60 * 60,
    data: { user: { id: String(userId) } },
  }));
  const sig = createHmac("sha256", secret)
    .update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${b64url(sig)}`;
}
const jwt = mintJwt(USER_ID, SECRET);

// ── 4. Playwright: cookies + screenshots ───────────────────────
const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const mobile  = await browser.newContext({ viewport: { width: 390,  height: 844 } });

for (const ctx of [desktop, mobile]) {
  await ctx.addCookies([
    { name: "pl_session",       value: jwt,    url: `http://localhost:${NEXT_PORT}`, httpOnly: true, sameSite: "Lax" },
    { name: "pl_age_confirmed", value: "true", url: `http://localhost:${NEXT_PORT}`, sameSite: "Lax" },
  ]);
}

const shots = [
  { ctx: desktop, path: "/account",        name: "01-overview-desktop"     },
  { ctx: desktop, path: "/account/orders", name: "02-orders-desktop"       },
  { ctx: mobile,  path: "/account",        name: "03-overview-mobile"      },
  { ctx: mobile,  path: "/account/orders", name: "04-orders-mobile"        },
];

for (const s of shots) {
  const page = await s.ctx.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror on ${s.path}]`, String(e)));
  await page.goto(`http://localhost:${NEXT_PORT}${s.path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOT}/${s.name}.png`, fullPage: true });
  console.log(`✓ ${s.name}.png (${s.path})`);
  await page.close();
}

await browser.close();
next.kill("SIGTERM");
mock.close();
console.log(`\ndone. screenshots: ${SHOT}/*.png`);
