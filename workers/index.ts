import "dotenv/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { inverters, vendorAccounts } from "../src/lib/db/schema";
import { QUEUE_POLL_INVERTER } from "../src/lib/queues";
import { createPollingWorker } from "./polling";
import { createTelegramWorkers } from "./telegram";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5 * 60 * 1000);

async function enqueueAllActive() {
  const rows = await db
    .select({
      inverterId: inverters.id,
      tenantId: inverters.tenantId,
    })
    .from(inverters)
    .innerJoin(
      vendorAccounts,
      eq(inverters.vendorAccountId, vendorAccounts.id),
    )
    .where(and(eq(vendorAccounts.status, "active")));

  if (!rows.length) {
    console.log("[worker] no active inverters to poll");
    return;
  }

  const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue(QUEUE_POLL_INVERTER, { connection });

  for (const row of rows) {
    await queue.add(
      "poll",
      { inverterId: row.inverterId, tenantId: row.tenantId },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
  }

  console.log(`[worker] enqueued ${rows.length} poll jobs`);
  await queue.close();
  await connection.quit();
}

async function main() {
  console.log("[worker] starting Cloud Deye workers…");
  console.log(`[worker] REDIS_URL=${process.env.REDIS_URL ?? "(default)"}`);
  console.log(`[worker] poll interval ${POLL_INTERVAL_MS}ms`);

  const polling = createPollingWorker();
  const { alertWorker, broadcastWorker } = createTelegramWorkers();

  // Immediate sweep + interval schedule
  await enqueueAllActive().catch((err) =>
    console.warn("[worker] initial enqueue failed:", err.message),
  );
  const timer = setInterval(() => {
    enqueueAllActive().catch((err) =>
      console.warn("[worker] schedule enqueue failed:", err.message),
    );
  }, POLL_INTERVAL_MS);

  const shutdown = async () => {
    console.log("[worker] shutting down…");
    clearInterval(timer);
    await Promise.all([
      polling.close(),
      alertWorker.close(),
      broadcastWorker.close(),
    ]);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[worker] listening on poll-inverter, send-alert, broadcast");
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
