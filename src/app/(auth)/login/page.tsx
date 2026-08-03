import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/wp-auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/account");
  return <LoginForm />;
}
