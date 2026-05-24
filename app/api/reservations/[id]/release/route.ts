import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json({
      id: reservation.id,
      status: reservation.status,
      message: "Reservation was already released",
    });
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "Cannot release a confirmed reservation" },
      { status: 409 }
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id },
      data: { status: "RELEASED", releasedAt: new Date() },
      include: { product: true, warehouse: true },
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

  return NextResponse.json({
    id: updated.id,
    productId: updated.productId,
    productName: updated.product.name,
    warehouseId: updated.warehouseId,
    warehouseName: updated.warehouse.name,
    quantity: updated.quantity,
    status: updated.status,
    releasedAt: updated.releasedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
}
