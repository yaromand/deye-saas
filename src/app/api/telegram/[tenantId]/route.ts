import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ tenantId: string }> };

/**
 * Telegram webhook placeholder.
 * Phase 4: verify secret, enqueue subscriber/command handling.
 */
export async function POST(request: Request, context: RouteContext) {
  const { tenantId } = await context.params;
  const body = await request.json().catch(() => null);

  console.log(
    `[telegram webhook] stub tenant=${tenantId} update=${JSON.stringify(body)?.slice(0, 200)}`,
  );

  return NextResponse.json({ ok: true, stub: true });
}
