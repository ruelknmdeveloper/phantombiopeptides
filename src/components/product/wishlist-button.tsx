"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlistToggle, type WishlistItem } from "@/hooks/use-wishlist-toggle";

interface Props {
  product: WishlistItem;
  className?: string;
}

export function WishlistButton({ product, className }: Props) {
  const { saved, toggle } = useWishlistToggle(product);

  return (
    <motion.button
      type="button"
      onClick={toggle}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      whileTap={{ scale: 0.85 }}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-all",
        saved
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background-elevated text-muted-foreground hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <motion.span
        key={saved ? "saved" : "empty"}
        initial={{ scale: saved ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
        className="inline-flex"
      >
        <Heart
          className={cn("h-4 w-4", saved && "fill-primary")}
          strokeWidth={2}
        />
      </motion.span>
    </motion.button>
  );
}
