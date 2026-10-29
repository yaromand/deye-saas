/**
 * Polling worker stub — Phase 2 will poll vendor adapters and write telemetry.
 * Run via: npm run worker
 */
import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { QUEUE_POLL_INVERTER } from "../src/lib/queues";

export type PollInverterJob = {
  inverterId: string;
  tenantId: string;
};

export function createPollingWorker(redisUrl = process.env.REDIS_URL) {
  const connection = new Redis(redisUrl ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<PollInverterJob>(
    QUEUE_POLL_INVERTER,
    async (job: Job<PollInverterJob>) => {
      // Stub: real adapter.fetchTelemetry + DB insert comes in Phase 2
      console.log(
        `[polling] stub job ${job.id} inverter=${job.data.inverterId} tenant=${job.data.tenantId}`,
      );
      return { ok: true, stub: true };
    },
    { connection },
  );

  worker.on("failed", (job, err) => {
    console.error(`[polling] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
