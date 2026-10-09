import { pool } from "../db";
import { financialCostPlanInput } from "@shared/financial-cost-plan";
import { getFinancialCutover } from "./financial-source-policy";

const fields = `id,concept,category,cost_type AS "costType",currency,monthly_amount::float AS "monthlyAmount",start_period AS "startPeriod",end_period AS "endPeriod",notes,active,version`;
export async function listFinancialCostPlans() {
  return (await pool.query(`SELECT ${fields} FROM financial_cost_plans ORDER BY active DESC,start_period,concept,id`)).rows;
}
export async function saveFinancialCostPlan(raw: unknown, actorId: number, id?: number) {
  const v = financialCostPlanInput.parse(raw);
  const cutover = await getFinancialCutover();
  if (!cutover || v.startPeriod < cutover) throw Object.assign(new Error("El presupuesto nativo requiere una fecha de corte y vigencia posterior o igual al corte."), { statusCode: 409 });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const previous = id ? (await c.query("SELECT * FROM financial_cost_plans WHERE id=$1 FOR UPDATE", [id])).rows[0] : null;
    if (id && !previous) throw Object.assign(new Error("El presupuesto no existe."), { statusCode: 404 });
    if (id && previous.version !== v.version) throw Object.assign(new Error("Otra persona modificó este presupuesto. Actualizá la página antes de guardar."), { statusCode: 409 });
    const values = [v.concept,v.category,v.costType,v.currency,v.monthlyAmount,v.startPeriod,v.endPeriod,v.notes ?? null,v.active,actorId];
    const { rows } = id
      ? await c.query(`UPDATE financial_cost_plans SET concept=$1,category=$2,cost_type=$3,currency=$4,monthly_amount=$5,start_period=$6,end_period=$7,notes=$8,active=$9,updated_by=$10,updated_at=now(),version=version+1 WHERE id=$11 RETURNING ${fields}`, [...values,id])
      : await c.query(`INSERT INTO financial_cost_plans(concept,category,cost_type,currency,monthly_amount,start_period,end_period,notes,active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING ${fields}`, values);
    await c.query(`INSERT INTO financial_audit_events(entity_type,entity_id,action,actor_user_id,before_data,after_data) VALUES('financial_cost_plan',$1,$2,$3,$4::jsonb,$5::jsonb)`, [rows[0].id,id ? "updated" : "created",actorId,JSON.stringify(previous),JSON.stringify(rows[0])]);
    await c.query("COMMIT");return rows[0];
  } catch(e) { await c.query("ROLLBACK");throw e; } finally { c.release(); }
}
