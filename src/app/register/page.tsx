import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return <AuthScreen mode="register" />;
}