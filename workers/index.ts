import "dotenv/config";
import { createPollingWorker } from "./polling";
import { createTelegramWorkers } from "./telegram";

async function main() {
  console.log("[worker] starting Cloud Deye workers (stubs)…");
  console.log(`[worker] REDIS_URL=${process.env.REDIS_URL ?? "(default)"}`);

  const polling = createPollingWorker();
  const { alertWorker, broadcastWorker } = createTelegramWorkers();

  const shutdown = async () => {
    console.log("[worker] shutting down…");
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
