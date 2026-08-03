"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { Logo } from "./logo";
import { SearchOverlay } from "./search-overlay";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";

const STATIC_NAV = [
  { href: "/shop", label: "Products" },
  { href: "/coa", label: "COA" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const { itemCount, openDrawer } = useCart();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  // Global keyboard shortcut: ⌘K / Ctrl+K opens the search overlay.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-close overlays when the user navigates (e.g. clicks a result).
  React.useEffect(() => {
    setSearchOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const nav = STATIC_NAV;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border bg-background shadow-[0_10px_30px_-20px_rgba(9,4,24,0.15)]",
      )}
    >
      <div className="container-page">
        <div className="flex h-16 items-center gap-4 lg:h-20 lg:gap-8">
          <Logo />

          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:hsl(var(--brand-500))] focus-visible:ring-offset-2",
                    active
                      ? "text-[color:hsl(var(--brand-500))]"
                      : "text-muted-foreground hover:text-[color:hsl(var(--brand-500))]",
                  )}
                >
                  {active && (
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "linear-gradient(135deg, hsl(var(--brand-100) / 0.9) 0%, hsl(var(--brand-50) / 0.9) 100%)",
                      }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/40 backdrop-blur transition-all hover:border-[color:hsl(var(--brand-500))]/40 hover:text-[color:hsl(var(--brand-500))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:hsl(var(--brand-500))] focus-visible:ring-offset-2"
              aria-label="Search products (⌘K)"
            >
              <Search className="h-4 w-4" />
            </button>
            <Link
              href="/account"
              prefetch={false}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/40 backdrop-blur transition-all hover:border-[color:hsl(var(--brand-500))]/40 hover:text-[color:hsl(var(--brand-500))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:hsl(var(--brand-500))] focus-visible:ring-offset-2"
              aria-label="Your account"
            >
              <User className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={openDrawer}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/40 backdrop-blur transition-all hover:border-[color:hsl(var(--brand-500))]/40 hover:text-[color:hsl(var(--brand-500))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:hsl(var(--brand-500))] focus-visible:ring-offset-2"
              aria-label={`Open cart (${itemCount} items)`}
            >
              <ShoppingBag className="h-4 w-4" />
              {itemCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ring-2 ring-background"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--brand-500)) 0%, hsl(var(--brand-400)) 100%)",
                  }}
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle>
                    <Logo />
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col px-2 pb-8 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      setSearchOpen(true);
                    }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium text-foreground/80 transition hover:bg-[color:hsl(var(--brand-50))] hover:text-[color:hsl(var(--brand-500))]"
                  >
                    <Search className="h-4 w-4" />
                    Search
                  </button>
                  {nav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl px-4 py-3 text-base font-medium text-foreground/80 transition hover:bg-[color:hsl(var(--brand-50))] hover:text-[color:hsl(var(--brand-500))]"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    href="/account"
                    prefetch={false}
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 flex items-center gap-3 rounded-xl border-t border-border px-4 py-3 pt-5 text-base font-medium text-foreground/80 transition hover:bg-[color:hsl(var(--brand-50))] hover:text-[color:hsl(var(--brand-500))]"
                  >
                    <User className="h-4 w-4" />
                    Account
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </header>
  );
}
