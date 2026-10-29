import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireTenant } from "@/lib/tenant";

export async function GET() {
  const auth = await requireTenant(["admin"]);
  if (!auth.ok) return auth.response;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return NextResponse.json({ users: rows });
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(120).optional(),
  role: z.enum(["admin", "client"]).optional().default("client"),
});

export async function POST(request: Request) {
  const auth = await requireTenant(["admin"]);
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json());
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
  if (existing.length) {
    return NextResponse.json(
      { error: "Email уже занят" },
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
      role: parsed.data.role,
      status: "active",
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
    });

  return NextResponse.json({ user }, { status: 201 });
}
