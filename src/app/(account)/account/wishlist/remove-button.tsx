"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeWishlistItemAction } from "@/app/actions/account";

export function RemoveWishlistButton({ productId }: { productId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await removeWishlistItemAction(productId);
        })
      }
      disabled={pending}
      aria-label="Remove from wishlist"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-50"
    >
      <X className="h-3 w-3" />
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
