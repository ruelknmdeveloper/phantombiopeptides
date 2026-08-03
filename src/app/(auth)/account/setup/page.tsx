import type { Metadata } from "next";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function SetupPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">
          Set your password
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Choose a password to activate your account. Links expire seven days
          after issue.
        </p>
      </div>
      <SetPasswordForm token={token ?? ""} />
    </div>
  );
}
