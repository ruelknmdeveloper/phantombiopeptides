"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Wishlist toggle. Two storage modes, picked per user:
 *
 *   • Signed in  — localStorage for instant optimistic UI, then a
 *                  fire-and-forget POST/DELETE to /api/wishlist that
 *                  writes to WordPress (visible on /account/wishlist).
 *   • Guest      — localStorage only. On next sign-in, wp-auth.ts
 *                  triggers /wishlist/merge to bring these items into
 *                  the server list.
 *
 * Auth is detected via the `pl_signed_in` cookie — a non-httpOnly
 * companion to the JWT cookie that JS can read.
 */

const KEY = "pl_wishlist";
const SIGNED_IN_COOKIE = "pl_signed_in";

interface WishlistItem {
  id: number;
  slug: string;
  name: string;
}

function readWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeWishlist(items: WishlistItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("wishlist:change"));
  } catch {
    /* localStorage disabled */
  }
}

function isSignedIn(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${SIGNED_IN_COOKIE}=1`));
}

async function syncAdd(productId: number) {
  try {
    await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
      keepalive: true,
    });
  } catch {
    /* fire-and-forget */
  }
}

async function syncRemove(productId: number) {
  try {
    await fetch(`/api/wishlist?product_id=${productId}`, {
      method: "DELETE",
      keepalive: true,
    });
  } catch {
    /* fire-and-forget */
  }
}

interface Props {
  product: WishlistItem;
  className?: string;
}

export function WishlistButton({ product, className }: Props) {
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(readWishlist().some((p) => p.id === product.id));
    const onChange = () =>
      setSaved(readWishlist().some((p) => p.id === product.id));
    window.addEventListener("wishlist:change", onChange);
    return () => window.removeEventListener("wishlist:change", onChange);
  }, [product.id]);

  function toggle() {
    const list = readWishlist();
    const exists = list.some((p) => p.id === product.id);
    const signedIn = isSignedIn();

    if (exists) {
      writeWishlist(list.filter((p) => p.id !== product.id));
      toast("Removed from wishlist");
      if (signedIn) void syncRemove(product.id);
    } else {
      writeWishlist([product, ...list]);
      toast.success(signedIn ? "Saved to your wishlist" : "Saved to wishlist");
      if (signedIn) void syncAdd(product.id);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-all",
        saved
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background-elevated text-muted-foreground hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <Heart
        className={cn("h-4 w-4", saved && "fill-primary")}
        strokeWidth={2}
      />
    </button>
  );
}
