import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

const RESERVATION_TTL_MINUTES = 10;

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const endpoint = "POST /api/reservations";

  // Check idempotency first
  const cached = await checkIdempotency(idempotencyKey, endpoint);
  if (cached) return cached;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;

  // Use a per-SKU+warehouse lock to prevent race conditions.
  // Only one reservation attempt for this product/warehouse pair can run at a time.
  const lockKey = `reserve:${productId}:${warehouseId}`;
  const lockToken = await acquireLock(lockKey, 15);

  if (!lockToken) {
    return NextResponse.json(
      { error: "Too many concurrent requests for this item. Please try again." },
      { status: 429 }
    );
  }

  try {
    // Inside the lock: read current stock and decide atomically
    const stock = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!stock) {
      const response = { error: "Product not found in this warehouse" };
      return NextResponse.json(response, { status: 404 });
    }

    const available = stock.total - stock.reserved;
    if (available < quantity) {
      const response = {
        error: "Not enough stock available",
        available,
        requested: quantity,
      };
      await storeIdempotency(idempotencyKey, endpoint, 409, response);
      return NextResponse.json(response, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    // Atomically increment reserved and create reservation in a transaction
    const [reservation] = await prisma.$transaction([
      prisma.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
        },
        include: {
          product: true,
          warehouse: true,
        },
      }),
      prisma.stock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { increment: quantity } },
      }),
    ]);

    const responseBody = {
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    };

    await storeIdempotency(idempotencyKey, endpoint, 201, responseBody);
    return NextResponse.json(responseBody, { status: 201 });
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}
