/**
 * Polling worker — fetches vendor metrics and writes telemetry_points.
 * Run via: npm run worker
 */
import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { pollInverter } from "../src/lib/ingest/poll-inverter";
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
      const { inverterId, tenantId } = job.data;
      console.log(
        `[polling] job ${job.id} inverter=${inverterId} tenant=${tenantId}`,
      );
      const result = await pollInverter(inverterId, tenantId);
      if (!result.ok) {
        throw new Error(result.error ?? "poll_failed");
      }
      return result;
    },
    { connection, concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[polling] job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job, result) => {
    console.log(
      `[polling] job ${job.id} ok status=${result?.status} powerW=${result?.powerW}`,
    );
  });

  return worker;
}
