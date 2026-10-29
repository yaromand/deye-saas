/**
 * Telegram worker stub — Phase 4 will send alerts/broadcasts.
 * Run via: npm run worker
 */
import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { QUEUE_BROADCAST, QUEUE_SEND_ALERT } from "../src/lib/queues";

export type SendAlertJob = {
  alertEventId: string;
  tenantId: string;
};

export type BroadcastJob = {
  broadcastId: string;
  tenantId: string;
};

export function createTelegramWorkers(redisUrl = process.env.REDIS_URL) {
  const connection = new Redis(redisUrl ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const alertWorker = new Worker<SendAlertJob>(
    QUEUE_SEND_ALERT,
    async (job: Job<SendAlertJob>) => {
      console.log(
        `[telegram] stub send-alert ${job.id} event=${job.data.alertEventId}`,
      );
      return { ok: true, stub: true };
    },
    { connection },
  );

  const broadcastWorker = new Worker<BroadcastJob>(
    QUEUE_BROADCAST,
    async (job: Job<BroadcastJob>) => {
      console.log(
        `[telegram] stub broadcast ${job.id} id=${job.data.broadcastId}`,
      );
      return { ok: true, stub: true };
    },
    { connection },
  );

  alertWorker.on("failed", (job, err) => {
    console.error(`[telegram] alert job ${job?.id} failed:`, err.message);
  });
  broadcastWorker.on("failed", (job, err) => {
    console.error(`[telegram] broadcast job ${job?.id} failed:`, err.message);
  });

  return { alertWorker, broadcastWorker };
}
