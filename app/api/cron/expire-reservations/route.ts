import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Called by Vercel Cron (every minute in production).
 * Finds all PENDING reservations past their expiresAt,
 * releases them, and restores stock in a single batch transaction.
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const expired = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
  });

  if (expired.length === 0) {
    return NextResponse.json({ released: 0, message: "No expired reservations" });
  }

  const stockDecrements = new Map<string, { productId: string; warehouseId: string; quantity: number }>();
  for (const r of expired as Array<{productId: string; warehouseId: string; quantity: number; id: string}>) {
    const key = `${r.productId}:${r.warehouseId}`;
    const existing = stockDecrements.get(key) as { productId: string; warehouseId: string; quantity: number } | undefined;
    if (existing) {
      existing.quantity += r.quantity;
    } else {
      stockDecrements.set(key, { productId: r.productId, warehouseId: r.warehouseId, quantity: r.quantity });
    }
  }

  await prisma.$transaction([
    prisma.reservation.updateMany({
      where: { id: { in: expired.map((r: { id: string }) => r.id) } },
      data: { status: "RELEASED", releasedAt: now },
    }),
    ...Array.from(stockDecrements.values()).map(({ productId, warehouseId, quantity }) =>
      prisma.stock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { decrement: quantity } },
      })
    ),
  ]);

  console.log(`[cron] Released ${expired.length} expired reservations`);
  return NextResponse.json({ released: expired.length });
}
