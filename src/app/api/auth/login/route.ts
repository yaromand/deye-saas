import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные" },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email)))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 },
      );
    }

    if (user.status === "blocked") {
      return NextResponse.json(
        { error: "Аккаунт заблокирован" },
        { status: 403 },
      );
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 },
      );
    }

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.role = user.role;
    session.tenantId = user.id;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: "Не удалось войти. Проверьте DATABASE_URL." },
      { status: 500 },
    );
  }
}
