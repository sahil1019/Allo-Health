import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIdempotency, storeIdempotency } from "@/lib/idempotency";

export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const endpoint = `POST /api/reservations/${id}/confirm`;

  const cached = await checkIdempotency(idempotencyKey, endpoint);
  if (cached) return cached;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status === "CONFIRMED") {
    const body = formatReservation(reservation);
    await storeIdempotency(idempotencyKey, endpoint, 200, body);
    return NextResponse.json(body);
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json({ error: "Reservation has already been released" }, { status: 409 });
  }

  // Check expiry
  if (new Date() > reservation.expiresAt) {
    // Lazily release: mark as released and restore stock
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "RELEASED", releasedAt: new Date() },
      }),
      prisma.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      }),
    ]);

    return NextResponse.json(
      { error: "Reservation has expired and stock has been released" },
      { status: 410 }
    );
  }

  // Confirm: decrement total stock (permanently) and clear the reservation hold
  const [updated] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: { product: true, warehouse: true },
    }),
    prisma.stock.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        total: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    }),
  ]);

  const body = formatReservation(updated);
  await storeIdempotency(idempotencyKey, endpoint, 200, body);
  return NextResponse.json(body);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatReservation(r: any) {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    warehouseId: r.warehouseId,
    warehouseName: r.warehouse.name,
    quantity: r.quantity,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
