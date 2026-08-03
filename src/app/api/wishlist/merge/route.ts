import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { getSession } from "@/lib/wp-auth";
import { phantom } from "@/lib/wp-fetch";

/**
 * Merge a guest's localStorage wishlist into the signed-in customer's
 * server wishlist. Called once by <WishlistSyncOnLogin> when it
 * detects a signed-in session with unsynced local items.
 *
 * Body: { items: [{ product_id, variation_id? }, ...] }
 *
 * Forwards to /wp-json/phantom/v1/wishlist/merge which does an
 * INSERT IGNORE per row (so re-merging is safe / idempotent).
 */

interface Body {
  items?: Array<{ product_id?: number; variation_id?: number }>;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const items = Array.isArray(body.items)
    ? body.items
        .map((r) => ({
          product_id: Number(r?.product_id),
          variation_id:
            typeof r?.variation_id === "number" ? r.variation_id : undefined,
        }))
        .filter((r) => Number.isInteger(r.product_id) && r.product_id > 0)
    : [];

  if (items.length === 0) {
    return NextResponse.json({ ok: true, merged: 0 });
  }

  try {
    const res = await phantom<{ ok: boolean; merged?: number }>(
      "/wishlist/merge",
      {
        method: "POST",
        bearer: session.token,
        body: { items: items.slice(0, 200) },
      },
    );
    revalidateTag(`user:${session.userId}:wishlist`, "default");
    revalidatePath("/account/wishlist");
    return NextResponse.json({ ok: true, merged: res.merged ?? items.length });
  } catch (err) {
    console.warn(
      "[api/wishlist/merge]",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ ok: false, error: "merge_failed" });
  }
}
