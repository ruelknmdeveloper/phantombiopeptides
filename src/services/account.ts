import "server-only";
import { unstable_cache } from "next/cache";
import { wc } from "./woocommerce";
import { phantom } from "@/lib/wp-fetch";

/**
 * Read the current customer's data via the /phantom/v1/* companion
 * plugin and Woo REST (server-side, using consumer_key/secret). All
 * reads are cached with per-user tags so webhooks can invalidate on
 * order updates.
 */

export interface AccountProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email_verified_at: string | null;
  phone: string | null;
  birthday: string | null;
  preferred_language: string | null;
  marketing_consent: boolean;
  billing: WcAccountAddress | null;
  shipping: WcAccountAddress | null;
}

export interface WcAccountAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface AccountOrderSummary {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  line_items_count: number;
}

export interface NotificationPrefs {
  order_updates: boolean;
  back_in_stock: boolean;
  price_drops: boolean;
  new_arrivals: boolean;
  promotions: boolean;
  newsletter: boolean;
  channels: { email: boolean; sms: boolean; push: boolean };
}

export interface WishlistItem {
  product_id: number;
  variation_id?: number | null;
  added_at: string;
}

export const AccountService = {
  async getProfile(bearer: string): Promise<AccountProfile> {
    return phantom<AccountProfile>("/me", { bearer, revalidate: 30 });
  },

  async getNotifications(bearer: string): Promise<NotificationPrefs> {
    return phantom<NotificationPrefs>("/notifications", { bearer, revalidate: 30 });
  },

  async getWishlist(bearer: string): Promise<WishlistItem[]> {
    const res = await phantom<{ items: WishlistItem[] }>("/wishlist", {
      bearer,
      revalidate: 30,
    });
    return res.items ?? [];
  },

  /**
   * List the last 25 orders for the user. Cached per-user for 60s.
   * Woo webhooks POST /api/revalidate with tag=user:{id}:orders to
   * bust this on order.updated.
   */
  async listOrders(userId: number): Promise<AccountOrderSummary[]> {
    const read = unstable_cache(
      async () => {
        const rows = await wc<Array<Record<string, unknown>>>("/orders", {
          query: {
            customer: userId,
            per_page: 25,
            orderby: "date",
            order: "desc",
          },
          revalidate: 60,
          tags: [`user:${userId}:orders`],
        });
        return rows.map(toOrderSummary);
      },
      [`user-orders-${userId}`],
      { revalidate: 60, tags: [`user:${userId}:orders`] },
    );
    return read();
  },

  async getOrder(
    userId: number,
    orderId: number,
  ): Promise<Record<string, unknown> | null> {
    const order = await wc<Record<string, unknown>>(`/orders/${orderId}`, {
      revalidate: 60,
      tags: [`user:${userId}:orders`, `order:${orderId}`],
    }).catch(() => null);
    if (!order) return null;
    // Enforce ownership even though the REST call is server-side —
    // /orders/{id} does not filter by customer.
    if ((order.customer_id as number | undefined) !== userId) return null;
    return order;
  },
};

function toOrderSummary(o: Record<string, unknown>): AccountOrderSummary {
  return {
    id: (o.id as number) ?? 0,
    number: String(o.number ?? o.id ?? ""),
    status: String(o.status ?? "pending"),
    date_created: String(o.date_created ?? ""),
    total: String(o.total ?? "0"),
    currency: String(o.currency ?? "USD"),
    line_items_count: Array.isArray(o.line_items)
      ? (o.line_items as unknown[]).length
      : 0,
  };
}
