import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { getSession } from "@/lib/wp-auth";
import { phantom } from "@/lib/wp-fetch";

/**
 * Wishlist proxy for signed-in customers. The WishlistButton client
 * component POSTs here to add / DELETEs to remove; we forward to
 * /wp-json/phantom/v1/wishlist with the customer's JWT so items land
 * in wp_pl_wishlist (visible on the /account/wishlist dashboard).
 *
 * Not called for guests — the button falls back to localStorage in
 * that case. A guest's localStorage list is later merged in via
 * POST /api/wishlist/merge after they sign in.
 *
 * Every mutation revalidates the per-user cache tag so /account/wishlist
 * reflects changes on the next request instead of after the 30s TTL.
 */

interface Body {
  product_id?: number;
  variation_id?: number;
}

function invalidateFor(userId: number) {
  revalidateTag(`user:${userId}:wishlist`, "default");
  revalidatePath("/account/wishlist");
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

  const product_id = Number(body.product_id);
  if (!Number.isInteger(product_id) || product_id <= 0) {
    return NextResponse.json({ ok: false, error: "bad_product_id" }, { status: 400 });
  }

  try {
    await phantom("/wishlist", {
      method: "POST",
      bearer: session.token,
      body: {
        product_id,
        variation_id:
          typeof body.variation_id === "number" ? body.variation_id : undefined,
      },
    });
    invalidateFor(session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn(
      "[api/wishlist POST]",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ ok: false, error: "sync_failed" });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }

  const url = new URL(req.url);
  const product_id = Number(url.searchParams.get("product_id"));
  if (!Number.isInteger(product_id) || product_id <= 0) {
    return NextResponse.json({ ok: false, error: "bad_product_id" }, { status: 400 });
  }

  try {
    await phantom(`/wishlist/${product_id}`, {
      method: "DELETE",
      bearer: session.token,
    });
    invalidateFor(session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn(
      "[api/wishlist DELETE]",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ ok: false, error: "sync_failed" });
  }
}
