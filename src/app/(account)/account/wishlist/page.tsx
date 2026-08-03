import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/wp-auth";
import { AccountService } from "@/services/account";
import { ProductsService } from "@/services/products";
import { RemoveWishlistButton } from "./remove-button";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const session = await getSession();
  if (!session) return null;

  const items = await AccountService.getWishlist(
    session.token,
    session.userId,
  ).catch(() => []);

  // Enrich each wishlist entry with live product data in parallel.
  const enriched = await Promise.all(
    items.map(async (it) => {
      const product = await ProductsService.getById(it.product_id).catch(
        () => null,
      );
      return { ...it, product };
    }),
  );
  const withProduct = enriched.filter(
    (r): r is typeof enriched[number] & { product: NonNullable<typeof r.product> } =>
      r.product !== null,
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-medium">Wishlist</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Items you&apos;ve saved. Sync across every device you sign in on.
        </p>
      </header>

      {withProduct.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {withProduct.map(({ product }) => {
            const image = product.images?.[0]?.src;
            const priceLabel = product.price ? `$${product.price}` : "";
            return (
              <li
                key={product.id}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-background-muted">
                  {image && (
                    <Image
                      src={image}
                      alt={product.name}
                      fill
                      sizes="80px"
                      className="object-contain p-2"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/product/${product.slug}`}
                    className="line-clamp-2 text-sm font-medium hover:text-brand-600"
                  >
                    {product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{priceLabel}</p>
                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href={`/product/${product.slug}`}
                      className="text-xs font-medium text-brand-600 hover:text-brand-500"
                    >
                      View →
                    </Link>
                    <RemoveWishlistButton productId={product.id} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">
        Your wishlist is empty. Tap the heart on any product to save it here.
      </p>
      <Link
        href="/shop"
        className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-500"
      >
        Browse the catalog →
      </Link>
    </div>
  );
}
