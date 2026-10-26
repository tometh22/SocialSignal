import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../shared/schema";
import { QUOTATION_EFFORT_BENCHMARKS_SQL } from "../server/queries/quotation-effort-benchmarks";

const databaseUrl = process.env.QUOTATION_BENCHMARK_DATABASE_URL;
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (databaseUrl && !localHosts.has(new URL(databaseUrl).hostname)) {
  throw new Error("QUOTATION_BENCHMARK_DATABASE_URL debe apuntar a PostgreSQL local aislado");
}

const describeLocalPostgres = databaseUrl ? describe : describe.skip;

describeLocalPostgres("quotation effort benchmark on isolated PostgreSQL", () => {
  let client: Client;
  let importedPool: { end: () => Promise<void> } | undefined;
  let versionRows: Array<{ version: number; status: string }>;
  let benchmarkRows: Array<Record<string, unknown>>;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`
      CREATE TEMP TABLE service_blueprints (
        id serial PRIMARY KEY, slug text NOT NULL, name text NOT NULL, description text,
        version integer NOT NULL, status text NOT NULL, definition jsonb NOT NULL,
        source_label text, created_by integer, published_by integer,
        published_at timestamp, created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(), UNIQUE (slug, version)
      );
      CREATE TEMP TABLE quotations (
        id integer PRIMARY KEY, service_blueprint_id integer, project_type text NOT NULL,
        project_duration text, scope_snapshot jsonb
      );
      CREATE TEMP TABLE active_projects (
        id integer PRIMARY KEY, quotation_id integer NOT NULL, status text NOT NULL,
        closed_at timestamp, is_finished boolean, workflow_stage text
      );
      CREATE TEMP TABLE time_entries (
        id integer PRIMARY KEY, project_id integer NOT NULL, personnel_id integer NOT NULL,
        date timestamp NOT NULL, hours double precision NOT NULL, description text
      );
      CREATE TEMP TABLE tasks (id integer PRIMARY KEY, project_id integer NOT NULL);
      CREATE TEMP TABLE task_time_entries (
        id integer PRIMARY KEY, task_id integer NOT NULL, personnel_id integer NOT NULL,
        date timestamp NOT NULL, hours double precision NOT NULL, description text
      );
    `);

    const seedModule = await import("../shared/quotation-professional");
    const seed = seedModule.SERVICE_BLUEPRINT_SEEDS.find((item) => item.slug === "estudio-one-shot");
    if (!seed) throw new Error("No se encontró la semilla de prueba del catálogo");
    for (const [version, status] of [
      [seed.version - 1, "published"],
      [seed.version, "published"],
      [seed.version + 1, "draft"],
      [seed.version + 2, "published"],
    ] as const) {
      await client.query(
        "INSERT INTO service_blueprints (slug,name,version,status,definition) VALUES ($1,$2,$3,$4,'{}'::jsonb)",
        [seed.slug, seed.name, version, status],
      );
    }

    await client.query(`
      INSERT INTO service_blueprints (id,slug,name,version,status,definition)
      VALUES (10,'fee-historico','Fee histórico',1,'published','{"durationMonths":3}'::jsonb),
             (11,'otro-fee','Otro fee',1,'published','{"durationMonths":3}'::jsonb);
      INSERT INTO quotations (id,service_blueprint_id,project_type,project_duration,scope_snapshot) VALUES
        (1,10,'always-on','3 meses','{"durationMonths":3}'::jsonb),
        (2,10,'fee-mensual','3 meses','{"durationMonths":3}'::jsonb),
        (3,10,'fee-mensual','6 meses','{"durationMonths":6}'::jsonb),
        (4,10,'fee-mensual','3 meses','{"durationMonths":3}'::jsonb),
        (5,11,'fee-mensual','3 meses','{"durationMonths":3}'::jsonb);
      INSERT INTO active_projects (id,quotation_id,status,closed_at,is_finished,workflow_stage) VALUES
        (1,1,'delivered',NULL,false,'finalizado'),
        (2,2,'invoiced',NULL,true,'finalizado'),
        (3,3,'completed',NULL,true,'finalizado'),
        (4,4,'cancelled',now(),true,'finalizado'),
        (5,5,'active',now(),false,'finalizado');
      INSERT INTO time_entries (id,project_id,personnel_id,date,hours,description) VALUES
        (1,1,5,'2026-01-01 09:00',8,'Análisis'),
        (2,1,5,'2026-01-01 10:00',2,'QA'),
        (3,2,5,'2026-01-02 09:00',30,'Informe'),
        (4,3,5,'2026-01-03 09:00',60,'Fee semestral'),
        (5,4,5,'2026-01-04 09:00',200,'Cancelado'),
        (6,5,5,'2026-01-05 09:00',45,'Otra receta');
      INSERT INTO tasks (id,project_id) VALUES (101,1),(102,1),(103,1);
      INSERT INTO task_time_entries (id,task_id,personnel_id,date,hours,description) VALUES
        (1,101,5,'2026-01-01 09:00',8,'  análisis '),
        (2,102,5,'2026-01-01 10:00',2,'QA'),
        (3,103,5,'2026-01-01 10:00',2,'QA'),
        (4,101,5,'2026-01-02 09:00',3,'Trabajo adicional');
    `);

    const testDb = drizzle({ client, schema });
    process.env.DATABASE_URL = databaseUrl!;
    const seedService = await import("../server/services/service-blueprints");
    await seedService.ensureServiceBlueprintSeeds(testDb);
    const dbModule = await import("../server/db");
    importedPool = dbModule.pool;

    const versions = await client.query(
      "SELECT version,status FROM service_blueprints WHERE slug=$1 ORDER BY version",
      [seed.slug],
    );
    versionRows = versions.rows;
    benchmarkRows = (await client.query(QUOTATION_EFFORT_BENCHMARKS_SQL)).rows;
  }, 30_000);

  afterAll(async () => {
    await importedPool?.end();
    if (client) await client.end();
  });

  it("deduplicates mirrored hours one-to-one and groups by canonical type and exact duration", () => {
    const sameRecipe = benchmarkRows.find((row) => row.service_blueprint_id === 10
      && row.project_type === "fee-mensual" && Number(row.duration_months) === 3);
    expect(sameRecipe).toMatchObject({ sample_size: 2, median_actual_hours: 22.5 });

    const generic = benchmarkRows.find((row) => row.service_blueprint_id == null
      && row.service_blueprint_slug == null
      && row.project_type === "fee-mensual" && Number(row.duration_months) === 3);
    expect(generic).toMatchObject({ sample_size: 3, median_actual_hours: 30 });

    const sixMonth = benchmarkRows.find((row) => row.service_blueprint_id === 10
      && row.project_type === "fee-mensual" && Number(row.duration_months) === 6);
    expect(sixMonth).toMatchObject({ sample_size: 1, median_actual_hours: 60 });
    expect(benchmarkRows.some((row) => Number(row.median_actual_hours) >= 200)).toBe(false);
  });

  it("keeps user-created versions when startup ensures static seeds", () => {
    expect(versionRows.map((row) => row.status)).toEqual(["archived", "published", "draft", "published"]);
  });
});
