// Usage: npx tsx scripts/reconcile-task-costs.ts YYYY-MM [--apply]
// Requires DATABASE_URL. Preview is the default, including blocked periods.
import { reconcileTaskCosts } from "../server/domain/reconcile-task-costs";
import { pool } from "../server/db";
const args = process.argv.slice(2);
try {
  if (args.some(arg => arg !== "--apply" && arg !== args[0])) throw new Error("Uso: YYYY-MM [--apply]");
  const result = await reconcileTaskCosts(args[0] ?? "", args.includes("--apply"));
  console.log(JSON.stringify(result, null, 2));
  if (args.includes("--apply") && !result.applied) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await pool.end(); }
