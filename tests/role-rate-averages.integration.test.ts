import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { roleRateAveragesQuery } from "../server/services/role-rate-averages";

const url = process.env.FINANCIAL_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Only a local test database is allowed");
const namespace = `role_averages_test_${process.pid}`;
let client: Client;

describe.skipIf(!url)("observed role averages with PostgreSQL", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: url });
    await client.connect();
    await client.query(`CREATE SCHEMA ${namespace}; SET search_path TO ${namespace}`);
    await client.query(`
      CREATE TABLE roles(id int PRIMARY KEY, name text);
      CREATE TABLE personnel(id int PRIMARY KEY, role_id int, "current_role" text, sublevel text, area text,
        contract_type text DEFAULT 'full-time', include_in_real_costs boolean DEFAULT true, active_until text);
      CREATE TABLE exchange_rates(id int PRIMARY KEY, year int, month int, rate numeric, rate_type text,
        is_active boolean DEFAULT true, specific_date date, updated_at timestamp DEFAULT now());
      CREATE TABLE personnel_historical_costs(personnel_id int, year int, month int, hourly_rate_ars numeric,
        hourly_rate_usd numeric, exchange_rate_id int, is_active boolean DEFAULT true, updated_at timestamp DEFAULT now());
      INSERT INTO roles VALUES(1,'Senior Operaciones'),(2,'Senior DataTech');
      INSERT INTO personnel(id,role_id,"current_role",sublevel,area) VALUES
        (1,1,'3 Senior','A','Operaciones'),(2,2,'3 Senior','A','DataTech');
      INSERT INTO personnel(id,role_id,"current_role",sublevel,area,contract_type) VALUES(3,1,'3 Senior','A','Operaciones','freelance');
      INSERT INTO personnel(id,role_id,"current_role",sublevel,area,active_until) VALUES(4,1,'3 Senior','A','Operaciones','2000-01-01');
      INSERT INTO personnel(id,role_id,"current_role",sublevel,area,include_in_real_costs) VALUES(5,1,'3 Senior','A','Operaciones',false);
      INSERT INTO exchange_rates(id,year,month,rate,rate_type) VALUES(1,2001,1,1000,'end_of_month');
      INSERT INTO personnel_historical_costs(personnel_id,year,month,hourly_rate_ars,exchange_rate_id) VALUES
        (1,2000,12,50,1),(1,2001,1,100,1),(2,2001,1,300,1),
        (3,2001,1,99999,1),(4,2001,1,99999,1),(5,2001,1,99999,1),(1,2199,12,99999,1);
    `);
  });
  afterAll(async () => {
    if (client) { await client.query(`DROP SCHEMA ${namespace} CASCADE`); await client.end(); }
  });
  it("returns distinct area identities so equal level/sublevel summaries cannot overwrite each other", async () => {
    const { rows } = await drizzle(client).execute(roleRateAveragesQuery);
    expect(rows.map(row => ({ area: row.area, ars: Number(row.average_rate_ars), usd: Number(row.average_rate_usd), people: row.personnel_count }))
      .sort((a, b) => a.area.localeCompare(b.area))).toEqual([
        { area: "DataTech", ars: 300, usd: 0.3, people: 1 },
        { area: "Operaciones", ars: 100, usd: 0.1, people: 1 },
      ]);
    const unique = new Map(rows.map(row => [`${row.role_name}-${row.sublevel}-${row.area}`, row]));
    expect(unique.size).toBe(2);
    expect([...unique.values()].reduce((sum, row) => sum + Number(row.average_rate_ars) * Number(row.personnel_count), 0) / 2).toBe(200);
  });
  it("converts ARS to USD when a legacy zero USD value represents an absent tariff", async () => {
    await client.query("UPDATE personnel_historical_costs SET hourly_rate_usd=0 WHERE personnel_id=1");
    const { rows } = await drizzle(client).execute(roleRateAveragesQuery);
    expect(Number(rows.find(row => row.role_id === 1)?.average_rate_usd)).toBe(0.1);
  });
  it("reads the latest current costs without changing rates, including excluded historical rows", async () => {
    const before = (await client.query("SELECT to_jsonb(c) data FROM personnel_historical_costs c ORDER BY personnel_id,year,month")).rows;
    await drizzle(client).execute(roleRateAveragesQuery);
    expect((await client.query("SELECT to_jsonb(c) data FROM personnel_historical_costs c ORDER BY personnel_id,year,month")).rows).toEqual(before);
  });
});
