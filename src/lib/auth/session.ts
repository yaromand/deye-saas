import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type UserRole = "admin" | "client";


export type SessionData = {
  userId?: string;
  email?: string;
  role?: UserRole;
  /** On MVP tenantId === userId */
  tenantId?: string;
  isLoggedIn: boolean;
};

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_SECRET;
  if (!password || password.length < 32) {
    // Allow boot without env for `next build` / lint; runtime will fail closed
    return {
      password: "complex_password_at_least_32_characters_long",
      cookieName: "deye_session",
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 14, // 14 days
        path: "/",
      },
    };
  }

  return {
    password,
    cookieName: "deye_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

export async function requireSession(roles?: UserRole[]) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return { ok: false as const, session, error: "unauthorized" };
  }
  if (roles && session.role && !roles.includes(session.role)) {
    return { ok: false as const, session, error: "forbidden" };
  }
  return { ok: true as const, session };
}
