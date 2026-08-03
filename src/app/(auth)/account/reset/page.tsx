import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const hasToken = Boolean(token);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">
          {hasToken ? "Choose a new password" : "Reset your password"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {hasToken
            ? "Reset links are single-use and expire 10 minutes after issue."
            : "We'll email you a link to set a new password."}
        </p>
      </div>
      <ResetForm token={token ?? ""} />
    </div>
  );
}
