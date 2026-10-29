import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["active", "blocked", "pending"]).optional(),
  role: z.enum(["admin", "client"]).optional(),
  name: z.string().max(120).nullable().optional(),
  /** If set, resets password hash (plaintext never returned) */
  newPassword: z.string().min(8).optional(),
});

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireTenant(["admin"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  if (id === auth.session.userId && parsed.data.status === "blocked") {
    return NextResponse.json(
      { error: "Нельзя заблокировать самого себя" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.role) updates.role = parsed.data.role;
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.newPassword) {
    updates.passwordHash = await hashPassword(parsed.data.newPassword);
  }

  const [user] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
    });

  if (!user) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  return NextResponse.json({
    user,
    passwordReset: Boolean(parsed.data.newPassword),
  });
}
