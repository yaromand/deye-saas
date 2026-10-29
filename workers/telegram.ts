/**
 * Telegram workers — deliver alerts and broadcasts to per-tenant bots.
 * Run via: npm run worker
 */
import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { QUEUE_BROADCAST, QUEUE_SEND_ALERT } from "../src/lib/queues";
import {
  deliverAlertEvent,
  deliverBroadcast,
} from "../src/lib/telegram/deliver";

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
      const result = await deliverAlertEvent(
        job.data.alertEventId,
        job.data.tenantId,
      );
      console.log(
        `[telegram] alert ${job.id} sent=${result.sent} err=${result.error ?? "-"}`,
      );
      if (result.error && result.sent === 0 && result.error !== "no_active_bot") {
        throw new Error(result.error);
      }
      return result;
    },
    { connection, concurrency: 2 },
  );

  const broadcastWorker = new Worker<BroadcastJob>(
    QUEUE_BROADCAST,
    async (job: Job<BroadcastJob>) => {
      const result = await deliverBroadcast(
        job.data.broadcastId,
        job.data.tenantId,
      );
      console.log(
        `[telegram] broadcast ${job.id} sent=${result.sent} err=${result.error ?? "-"}`,
      );
      if (result.error && result.sent === 0 && result.error !== "no_active_bot") {
        throw new Error(result.error);
      }
      return result;
    },
    { connection, concurrency: 1 },
  );

  alertWorker.on("failed", (job, err) => {
    console.error(`[telegram] alert job ${job?.id} failed:`, err.message);
  });
  broadcastWorker.on("failed", (job, err) => {
    console.error(`[telegram] broadcast job ${job?.id} failed:`, err.message);
  });

  return { alertWorker, broadcastWorker };
}
