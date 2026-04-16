import { AppShell } from "@/components/shared/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
