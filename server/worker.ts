import { pool } from "./db";
import { startAppEvents, stopAppEvents } from "./services/app-events";
import { startBackgroundJobs } from "./services/background-jobs";
import { stopJobs } from "./services/job-lock";

void (async () => {
await pool.query("SELECT 1");
await startAppEvents();
const stopBackground = await startBackgroundJobs();
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 25_000); deadline.unref();
  await Promise.all([stopBackground(), stopJobs()]);
  await stopAppEvents(); await pool.end(); clearTimeout(deadline);
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
console.log("Mind worker ready");

})().catch(error => { console.error("Worker startup failed", error); process.exit(1); });
