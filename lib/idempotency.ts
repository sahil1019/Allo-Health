import { prisma } from "./prisma";
import { NextResponse } from "next/server";

/**
 * Check if a request with this idempotency key has been seen before.
 * If so, return the cached response. Otherwise return null (caller should proceed).
 *
 * We use the DB for idempotency storage (an in-flight window could use Redis,
 * but DB is simpler and survives restarts).
 */
export async function checkIdempotency(
  key: string | null,
  endpoint: string
): Promise<NextResponse | null> {
  if (!key) return null;

  const record = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (!record) return null;

  // Ensure key was used for the same endpoint
  if (record.endpoint !== endpoint) {
    return NextResponse.json(
      { error: "Idempotency-Key reused across different endpoints" },
      { status: 422 }
    );
  }

  return NextResponse.json(record.responseBody, { status: record.statusCode });
}

export async function storeIdempotency(
  key: string | null,
  endpoint: string,
  statusCode: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseBody: any
): Promise<void> {
  if (!key) return;

  await prisma.idempotencyRecord.upsert({
    where: { key },
    create: { key, endpoint, statusCode, responseBody },
    update: {},
  });
}
