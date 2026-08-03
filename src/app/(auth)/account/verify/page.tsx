import type { Metadata } from "next";
import Link from "next/link";
import { phantom } from "@/lib/wp-fetch";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  let ok = false;
  let message = "";
  if (token) {
    try {
      await phantom("/auth/verify-email", {
        method: "POST",
        body: { token },
      });
      ok = true;
    } catch (err) {
      message =
        err instanceof Error
          ? err.message
          : "This link is invalid or expired.";
    }
  } else {
    message = "Missing verification token.";
  }

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-medium tracking-tight">
        {ok ? "Email verified" : "We couldn't verify this email"}
      </h1>
      <p className="text-sm text-neutral-500">
        {ok
          ? "Thanks — your email address is confirmed."
          : message}
      </p>
      <Link
        href={ok ? "/account" : "/login"}
        className="inline-block text-sm text-neutral-900 underline underline-offset-2"
      >
        {ok ? "Go to your account" : "Back to sign in"}
      </Link>
    </div>
  );
}
