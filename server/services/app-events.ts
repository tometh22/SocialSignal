import pg from "pg";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { pool } from "../db";

type AppEvent = { topic: "cache"; resource?: "tasks" | "projects" | "quotations" | "crm" | "finance" } | { topic: "chat"; conversationId: number };
const instance = randomUUID();
const events = new EventEmitter();
let client: pg.Client | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
let stopped = false;

export function onAppEvent(listener: (event: AppEvent) => void) {
  events.on("event", listener);
  return () => { events.off("event", listener); };
}

export async function publishAppEvent(event: AppEvent) {
  events.emit("event", event);
  await pool.query("SELECT pg_notify('mind_app_events', $1)", [JSON.stringify({ ...event, instance })]);
}

/** LISTEN uses its own connection, never a checked-out connection from the web pool. */
export async function startAppEvents() {
  stopped = false;
  const connection = new pg.Client({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000, application_name: "mind-events" });
  client = connection;
  let disconnected = false;
  const reconnect = () => {
    if (disconnected) return;
    disconnected = true;
    void connection.end().catch(() => {});
    if (!stopped) { retry = setTimeout(() => void startAppEvents().catch(() => {}), 3000 + Math.random() * 2000); retry.unref(); }
  };
  connection.on("error", reconnect);
  connection.on("end", reconnect);
  connection.on("notification", message => {
    try {
      const event = JSON.parse(message.payload || "{}");
      if (event.instance === instance) return;
      if (event.topic === "cache" || (event.topic === "chat" && Number.isSafeInteger(event.conversationId))) events.emit("event", event);
    } catch { /* malformed database notifications do not reach clients */ }
  });
  try {
    await connection.connect();
    await connection.query("LISTEN mind_app_events");
    // Clear data cached while the listener was offline.
    events.emit("event", { topic: "cache" });
  } catch (error) { reconnect(); throw error; }
}

export async function stopAppEvents() {
  stopped = true;
  if (retry) clearTimeout(retry);
  await client?.end().catch(() => {});
}
