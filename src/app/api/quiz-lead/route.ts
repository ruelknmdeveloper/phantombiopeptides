import { NextResponse } from "next/server";
import { phantom } from "@/lib/wp-fetch";
import { env } from "@/env";

/**
 * Browser POSTs quiz lead data here. We forward it to the WP plugin
 * with the service token attached (which the browser never sees).
 *
 * CORS is wide-open (`*`) because the endpoint has no auth to protect
 * — worst case someone spams quiz submissions and we add rate limiting.
 * This lets the standalone quiz.html deploy on any origin (Vercel
 * preview, ad landing page on a different domain, etc.) and still
 * capture leads through this pipeline.
 *
 * Fire-and-forget semantics: the client never blocks on this, but we
 * still return a real response so error tracking sees the failures.
 */

interface QuizAnswer {
  id: string;
  question?: string;
  answer: string | string[];
}

interface QuizLeadBody {
  stage?: "started" | "completed";
  email?: string;
  first_name?: string;
  phone?: string;
  answers?: QuizAnswer[];
  consent?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  if (!env.PHANTOM_SERVICE_TOKEN) {
    // Deliberately opaque — the browser gets a friendly 200 either way
    // so a misconfigured server doesn't interrupt the funnel.
    console.warn("[quiz-lead] PHANTOM_SERVICE_TOKEN is not configured");
    return withCors(NextResponse.json({ ok: false, error: "not_configured" }));
  }

  let body: QuizLeadBody = {};
  try {
    body = (await req.json()) as QuizLeadBody;
  } catch {
    return withCors(
      NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }),
    );
  }

  const stage = body.stage;
  const email = (body.email ?? "").trim();
  if (stage !== "started" && stage !== "completed") {
    return withCors(
      NextResponse.json({ ok: false, error: "invalid_stage" }, { status: 400 }),
    );
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return withCors(
      NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 }),
    );
  }

  // Best-effort client hints — WP records these for CRM context.
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  try {
    const res = await phantom<{ ok: boolean; pdf_url?: string | null }>(
      "/quiz/lead",
      {
        method: "POST",
        service: true,
        body: {
          stage,
          email,
          first_name: body.first_name,
          phone: body.phone,
          answers: body.answers,
          consent: !!body.consent,
          utm_source: body.utm_source,
          utm_medium: body.utm_medium,
          utm_campaign: body.utm_campaign,
          referrer: body.referrer,
          ip,
          user_agent: userAgent,
        },
      },
    );
    return withCors(
      NextResponse.json({
        ok: true,
        pdf_url: res.pdf_url ?? null,
      }),
    );
  } catch (err) {
    console.warn(
      "[quiz-lead] WP forward failed",
      err instanceof Error ? err.message : String(err),
    );
    // Never surface a hard error to the funnel — the vendor spec was
    // explicit about this. Missing WP just means the lead didn't
    // capture; the customer still sees the guide link on the client
    // if we can render one.
    return withCors(NextResponse.json({ ok: false, error: "capture_failed" }));
  }
}
