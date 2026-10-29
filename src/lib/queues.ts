import { Queue } from "bullmq";
import { getRedis } from "./redis";

export const QUEUE_POLL_INVERTER = "poll-inverter";
export const QUEUE_SEND_ALERT = "send-alert";
export const QUEUE_BROADCAST = "broadcast";

function connection() {
  return getRedis();
}

let pollQueue: Queue | null = null;
let alertQueue: Queue | null = null;
let broadcastQueue: Queue | null = null;

export function getPollQueue() {
  if (!pollQueue) {
    pollQueue = new Queue(QUEUE_POLL_INVERTER, { connection: connection() });
  }
  return pollQueue;
}

export function getAlertQueue() {
  if (!alertQueue) {
    alertQueue = new Queue(QUEUE_SEND_ALERT, { connection: connection() });
  }
  return alertQueue;
}

export function getBroadcastQueue() {
  if (!broadcastQueue) {
    broadcastQueue = new Queue(QUEUE_BROADCAST, { connection: connection() });
  }
  return broadcastQueue;
}
