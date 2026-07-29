import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Two jobs, one place — proxy runs at the edge on every page request.
 *
 *   1. Inject the current pathname as `x-pl-pathname` so the root
 *      layout (a server component) can decide whether to render site
 *      chrome. Client-only detection via usePathname doesn't resolve
 *      reliably during SSR from inside the root layout, so this is
 *      the cleanest way to hide the navbar/footer on standalone ad
 *      landing pages (/quiz) without a flash of chrome.
 *
 *   2. Gate the customer dashboard. Doing the auth redirect at the
 *      edge, before React renders, avoids a client-Router hook-count
 *      mismatch that occurs when a server-component layout throws
 *      redirect() and the streamed redirect is followed by Next 16.
 */

const PUBLIC_ACCOUNT_PATHS = new Set<string>([
  "/account/setup",
  "/account/reset",
  "/account/verify",
]);

function isAccountGated(pathname: string): boolean {
  return pathname === "/account" || pathname.startsWith("/account/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set("x-pl-pathname", pathname);
  const passthrough = NextResponse.next({
    request: { headers: forwardHeaders },
  });

  if (!isAccountGated(pathname) || PUBLIC_ACCOUNT_PATHS.has(pathname)) {
    return passthrough;
  }
  if (request.cookies.has("pl_session")) {
    return passthrough;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Match every page-rendered route. Skip Next internals, API handlers,
  // and static asset extensions so we don't waste edge cycles on
  // requests that don't need the pathname header.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
