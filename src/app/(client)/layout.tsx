import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { getSession } from "@/lib/auth/session";

// Session cookie — blocking route until Cache Components patterns adopted
export const instant = false;

export default async function ClientLayout({

  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }
  if (session.role === "admin") {
    redirect("/admin/users");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <AppNav role={session.role} email={session.email} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
