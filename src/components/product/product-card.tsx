"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag, Star, ArrowRight, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/use-cart";
import { useWishlistToggle } from "@/hooks/use-wishlist-toggle";
import { calculateDiscount, cn, formatPrice } from "@/lib/utils";
import type { WCProduct } from "@/types";

interface ProductCardProps {
  product: WCProduct;
  priority?: boolean;
  className?: string;
  /** Surface variant. "light" (default) sits on light sections; "dark"
   *  swaps the info panel for a translucent dark tile that reads on a
   *  brand-black surface (e.g. the Bestsellers rail). */
  variant?: "light" | "dark";
}

/**
 * Glassmorphism product card — light glass info panel over a brand-tinted
 * media plinth. Hover: gentle lift, brighter halo, image cross-fades to
 * the secondary shot.
 */
export function ProductCard({
  product,
  priority,
  className,
  variant = "light",
}: ProductCardProps) {
  const { addItem, isLoading } = useCart();
  const { saved, toggle: toggleWishlist } = useWishlistToggle({
    id: product.id,
    slug: product.slug,
    name: product.name,
  });
  const discount = product.on_sale
    ? calculateDiscount(product.regular_price, product.sale_price || product.price)
    : 0;
  const primary = product.images[0];
  const secondary = product.images[1] ?? product.images[0];
  const outOfStock = product.stock_status === "outofstock";
  const isVariable = product.type === "variable";
  const priceLabel = isVariable
    ? `From ${formatPrice(product.price)}`
    : formatPrice(product.price);
  const isDark = variant === "dark";

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl backdrop-blur-md transition-all duration-500",
        isDark
          ? "bg-white/[0.04] ring-1 ring-white/10 shadow-[0_18px_40px_-25px_rgba(0,0,0,0.7)] hover:ring-[color:hsl(var(--brand-300))]/40 hover:shadow-[0_45px_80px_-30px_hsl(var(--brand-500)/0.55)]"
          : "bg-white/80 ring-1 ring-black/5 shadow-[0_10px_30px_-15px_rgba(9,4,24,0.15)] hover:ring-[color:hsl(var(--brand-500))]/25 hover:shadow-[0_35px_60px_-25px_hsl(var(--brand-500)/0.35)]",
        className,
      )}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 18%, #4900AD 0%, #060606 78%)",
        }}
      >
        {/* Ambient halo behind product */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(45% 45% at 50% 40%, rgba(168,121,255,0.35) 0%, transparent 65%)",
          }}
        />
        {primary && (
          <>
            <Image
              src={primary.src}
              alt={primary.alt || product.name}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
            />
            {secondary && secondary !== primary && (
              <Image
                src={secondary.src}
                alt=""
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
              />
            )}
          </>
        )}

        {/* Left column of chips — status / new */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.tags.some((t) => t.slug === "new") && (
            <Badge variant="accent">New</Badge>
          )}
          {outOfStock && (
            <span className="glass rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
              Sold out
            </span>
          )}
        </div>

        {/* Right column — sale + rating */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {discount > 0 && (
            <span className="chip-brand rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest">
              -{discount}%
            </span>
          )}
          {product.rating_count > 0 && (
            <div className="glass flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-foreground">
              <Star className="h-3 w-3 fill-warning text-warning" />
              <span>{product.average_rating}</span>
            </div>
          )}
        </div>

        {/* Wishlist heart — bottom-right of media. Optimistic
            localStorage toggle, plus fire-and-forget /api/wishlist
            sync when signed in. Spring pop on state change. */}
        <motion.button
          type="button"
          aria-label={
            saved
              ? `Remove ${product.name} from wishlist`
              : `Save ${product.name} to wishlist`
          }
          aria-pressed={saved}
          whileTap={{ scale: 0.82 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist();
          }}
          className={cn(
            "glass absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full transition-all",
            saved
              ? "text-[color:hsl(var(--brand-500))] opacity-100 translate-y-0"
              : "text-foreground/70 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 hover:text-[color:hsl(var(--brand-500))]",
          )}
        >
          <motion.span
            key={saved ? "on" : "off"}
            initial={{ scale: saved ? 0.5 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 14 }}
            className="inline-flex"
          >
            <Heart
              className={cn(
                "h-4 w-4",
                saved && "fill-[color:hsl(var(--brand-500))]",
              )}
              strokeWidth={2}
            />
          </motion.span>
        </motion.button>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-5">
        {product.categories[0] && (
          <p
            className={cn(
              "text-[10px] uppercase tracking-[0.16em]",
              isDark
                ? "text-[color:hsl(var(--brand-300))]"
                : "text-[color:hsl(var(--brand-500))]",
            )}
          >
            {product.categories[0].name}
          </p>
        )}
        <Link
          href={`/product/${product.slug}`}
          className={cn(
            "font-display text-lg font-bold leading-snug tracking-tight transition-colors",
            isDark
              ? "text-white hover:text-[color:hsl(var(--brand-200))]"
              : "text-foreground hover:text-[color:hsl(var(--brand-500))]",
          )}
        >
          {product.name}
        </Link>
        <p
          className={cn(
            "line-clamp-2 text-sm leading-relaxed",
            isDark ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {product.short_description}
        </p>
        <div className="mt-auto flex items-end justify-between pt-4">
          <div className="flex flex-col">
            {isVariable && (
              <span
                className={cn(
                  "text-[10px] uppercase tracking-[0.16em]",
                  isDark ? "text-white/50" : "text-muted-foreground",
                )}
              >
                From
              </span>
            )}
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "font-display text-xl font-bold",
                  isDark ? "text-white" : "text-foreground",
                )}
              >
                {isVariable ? formatPrice(product.price) : priceLabel}
              </span>
              {product.on_sale && !isVariable && (
                <span
                  className={cn(
                    "text-xs line-through",
                    isDark ? "text-white/40" : "text-muted-foreground",
                  )}
                >
                  {formatPrice(product.regular_price)}
                </span>
              )}
            </div>
          </div>
          {isVariable ? (
            <Link
              href={`/product/${product.slug}`}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold uppercase tracking-wider text-white transition-all",
                "bg-[color:hsl(var(--brand-500))] hover:bg-[color:hsl(var(--brand-400))]",
                "shadow-[0_10px_24px_-10px_hsl(var(--brand-500)/0.55)]",
              )}
              aria-label={`Choose options for ${product.name}`}
            >
              Options
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled={outOfStock || isLoading}
              onClick={() => addItem(product.id, 1)}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold uppercase tracking-wider text-white transition-all",
                "bg-[color:hsl(var(--brand-500))] hover:bg-[color:hsl(var(--brand-400))]",
                "shadow-[0_10px_24px_-10px_hsl(var(--brand-500)/0.55)]",
                "disabled:opacity-40",
              )}
              aria-label={`Add ${product.name} to cart`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
