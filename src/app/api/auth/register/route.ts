import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: parsed.data.name,
        role: "client",
        status: "active",
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
      });

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.role = user.role;
    session.tenantId = user.id; // MVP: one user = one tenant
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json(
      { error: "Не удалось зарегистрироваться. Проверьте DATABASE_URL." },
      { status: 500 },
    );
  }
}
