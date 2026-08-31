import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { logger } from "@/lib/logger";

/** Never cache: a cached health check reports the state of a past request. */
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe. The e2e suite waits on it before running, and it
 * is the one endpoint an uptime monitor should watch.
 *
 * It touches the database on purpose — a deployment that answers HTTP but cannot
 * reach its own storage is not healthy, and a probe that only proves the event
 * loop is alive would report green straight through a misconfigured
 * `DATABASE_PATH`, which is exactly the Turso failure worth catching.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await db.get(sql`select 1`);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    logger.error("health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
