import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/wp-auth";
import { clearSessionCookie } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";
import { logoutAction } from "@/app/actions/auth";

/**
 * Auth gate for /account/* runs at the edge in src/proxy.ts. By the
 * time this layout renders, a session cookie is present. The layout
 * still verifies the JWT and bails if it's tampered/expired — but by
 * clearing the cookie and returning a client-side redirect, so the
 * next request re-triggers the edge gate cleanly (no server-component
 * redirect() from a layout, which trips Next 16's client Router).
 */
export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();

  let profile;
  try {
    if (!session) throw new Error("no session");
    profile = await AccountService.getProfile(session.token);
  } catch {
    await clearSessionCookie();
    redirect("/login");
  }

  const displayName =
    profile.display_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            Your account
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-3xl">
            {displayName}
          </h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <nav className="md:sticky md:top-24 md:self-start">
          <ul className="flex gap-2 overflow-x-auto md:flex-col md:gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block whitespace-nowrap rounded px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/security", label: "Security" },
  { href: "/account/support", label: "Support" },
];
