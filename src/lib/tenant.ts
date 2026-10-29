import { NextResponse } from "next/server";
import { requireSession, type SessionData, type UserRole } from "./auth/session";

export type TenantSession = SessionData & {
  userId: string;
  tenantId: string;
  role: UserRole;
  isLoggedIn: true;
};

export async function requireTenant(roles: UserRole[] = ["client", "admin"]) {
  const result = await requireSession(roles);
  if (!result.ok || !result.session.userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: result.error === "forbidden" ? "Доступ запрещён" : "Не авторизован" },
        { status: result.error === "forbidden" ? 403 : 401 },
      ),
    };
  }

  const tenantId = result.session.tenantId ?? result.session.userId;
  const session: TenantSession = {
    ...result.session,
    userId: result.session.userId,
    tenantId,
    role: result.session.role ?? "client",
    isLoggedIn: true,
  };

  return { ok: true as const, session };
}
