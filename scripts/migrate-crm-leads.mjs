/**
 * Migración de leads CRM entre bases de datos.
 *
 * Uso:
 *   # Solo diagnóstico (sin migrar):
 *   SOURCE_DB_URL="postgres://..." node scripts/migrate-crm-leads.mjs --check
 *
 *   # Migrar de source a target:
 *   SOURCE_DB_URL="postgres://..." TARGET_DB_URL="postgres://..." node scripts/migrate-crm-leads.mjs --migrate
 *
 * Tablas que migra (en orden por FK):
 *   crm_stages → crm_leads → crm_contacts → crm_activities → crm_reminders
 */

import pg from "pg";
const { Pool } = pg;

const SOURCE_DB_URL = process.env.SOURCE_DB_URL;
const TARGET_DB_URL = process.env.TARGET_DB_URL;
const mode = process.argv[2]; // --check or --migrate

if (!SOURCE_DB_URL) {
  console.error("❌ Falta SOURCE_DB_URL. Ejemplo:");
  console.error('   SOURCE_DB_URL="postgres://user:pass@host:5432/db" node scripts/migrate-crm-leads.mjs --check');
  process.exit(1);
}

if (mode === "--migrate" && !TARGET_DB_URL) {
  console.error("❌ Para migrar necesitás TARGET_DB_URL también.");
  process.exit(1);
}

if (!mode || !["--check", "--migrate"].includes(mode)) {
  console.error("❌ Usá --check o --migrate");
  process.exit(1);
}

const sourcePool = new Pool({ connectionString: SOURCE_DB_URL, ssl: { rejectUnauthorized: false } });

async function checkDatabase(pool, label) {
  const client = await pool.connect();
  try {
    console.log(`\n📊 === ${label} ===`);

    // Check if crm_leads table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'crm_leads'
      ) as exists
    `);
    if (!tableCheck.rows[0].exists) {
      console.log("   ⚠️  Tabla crm_leads NO existe en esta base de datos");
      return null;
    }

    const leads = await client.query("SELECT COUNT(*) as count FROM crm_leads");
    const contacts = await client.query("SELECT COUNT(*) as count FROM crm_contacts");
    const activities = await client.query("SELECT COUNT(*) as count FROM crm_activities");
    const reminders = await client.query("SELECT COUNT(*) as count FROM crm_reminders");
    const stages = await client.query("SELECT COUNT(*) as count FROM crm_stages");

    const byStage = await client.query(
      "SELECT stage, COUNT(*) as count FROM crm_leads GROUP BY stage ORDER BY count DESC"
    );

    const idRange = await client.query("SELECT MIN(id) as min_id, MAX(id) as max_id FROM crm_leads");

    console.log(`   Leads:      ${leads.rows[0].count}`);
    console.log(`   Contactos:  ${contacts.rows[0].count}`);
    console.log(`   Actividades:${activities.rows[0].count}`);
    console.log(`   Reminders:  ${reminders.rows[0].count}`);
    console.log(`   Stages:     ${stages.rows[0].count}`);
    console.log(`   ID range:   ${idRange.rows[0].min_id} - ${idRange.rows[0].max_id}`);
    console.log(`   Por etapa:`);
    for (const row of byStage.rows) {
      console.log(`     ${row.stage}: ${row.count}`);
    }

    return {
      leads: parseInt(leads.rows[0].count),
      contacts: parseInt(contacts.rows[0].count),
      activities: parseInt(activities.rows[0].count),
      reminders: parseInt(reminders.rows[0].count),
    };
  } finally {
    client.release();
  }
}

async function migrateData(sourcePool, targetPool) {
  const src = await sourcePool.connect();
  const tgt = await targetPool.connect();

  try {
    // 1. Migrate crm_stages
    console.log("\n🔄 Migrando crm_stages...");
    const srcStages = await src.query("SELECT * FROM crm_stages ORDER BY id");
    for (const row of srcStages.rows) {
      await tgt.query(
        `INSERT INTO crm_stages (id, key, label, color, position, is_active, follow_up_days, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET key=EXCLUDED.key, label=EXCLUDED.label, color=EXCLUDED.color,
           position=EXCLUDED.position, is_active=EXCLUDED.is_active, follow_up_days=EXCLUDED.follow_up_days`,
        [row.id, row.key, row.label, row.color, row.position, row.is_active, row.follow_up_days, row.created_at]
      );
    }
    console.log(`   ✅ ${srcStages.rows.length} stages migrados`);

    // 2. Migrate crm_leads
    console.log("🔄 Migrando crm_leads...");
    const srcLeads = await src.query("SELECT * FROM crm_leads ORDER BY id");
    let insertedLeads = 0;
    let skippedLeads = 0;
    for (const row of srcLeads.rows) {
      try {
        await tgt.query(
          `INSERT INTO crm_leads (id, company_name, stage, source, estimated_value_usd, notes, client_id,
             assigned_to, lost_reason, won_at, lost_at, created_at, updated_at, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (id) DO NOTHING`,
          [row.id, row.company_name, row.stage, row.source, row.estimated_value_usd, row.notes,
           row.client_id, row.assigned_to, row.lost_reason, row.won_at, row.lost_at,
           row.created_at, row.updated_at, row.created_by]
        );
        insertedLeads++;
      } catch (err) {
        skippedLeads++;
        if (skippedLeads <= 5) console.log(`   ⚠️  Lead ${row.id} (${row.company_name}): ${err.message}`);
      }
    }
    console.log(`   ✅ ${insertedLeads} leads migrados, ${skippedLeads} con errores`);

    // Reset sequence to max id
    if (srcLeads.rows.length > 0) {
      const maxId = Math.max(...srcLeads.rows.map(r => r.id));
      await tgt.query(`SELECT setval('crm_leads_id_seq', $1, true)`, [maxId]);
      console.log(`   🔧 Secuencia reseteada a ${maxId}`);
    }

    // 3. Migrate crm_contacts
    console.log("🔄 Migrando crm_contacts...");
    const srcContacts = await src.query("SELECT * FROM crm_contacts ORDER BY id");
    let insertedContacts = 0;
    for (const row of srcContacts.rows) {
      try {
        await tgt.query(
          `INSERT INTO crm_contacts (id, lead_id, name, email, phone, position, is_primary, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO NOTHING`,
          [row.id, row.lead_id, row.name, row.email, row.phone, row.position, row.is_primary, row.created_at]
        );
        insertedContacts++;
      } catch (err) {
        if (insertedContacts < 5) console.log(`   ⚠️  Contact ${row.id}: ${err.message}`);
      }
    }
    console.log(`   ✅ ${insertedContacts} contacts migrados`);

    // 4. Migrate crm_activities
    console.log("🔄 Migrando crm_activities...");
    const srcActivities = await src.query("SELECT * FROM crm_activities ORDER BY id");
    let insertedActs = 0;
    for (const row of srcActivities.rows) {
      try {
        await tgt.query(
          `INSERT INTO crm_activities (id, lead_id, type, title, content, activity_date, quotation_id, email_metadata, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (id) DO NOTHING`,
          [row.id, row.lead_id, row.type, row.title, row.content, row.activity_date,
           row.quotation_id, row.email_metadata, row.created_by, row.created_at]
        );
        insertedActs++;
      } catch (err) {
        if (insertedActs < 5) console.log(`   ⚠️  Activity ${row.id}: ${err.message}`);
      }
    }
    console.log(`   ✅ ${insertedActs} activities migradas`);

    // 5. Migrate crm_reminders
    console.log("🔄 Migrando crm_reminders...");
    const srcReminders = await src.query("SELECT * FROM crm_reminders ORDER BY id");
    let insertedRem = 0;
    for (const row of srcReminders.rows) {
      try {
        await tgt.query(
          `INSERT INTO crm_reminders (id, lead_id, description, due_date, completed, completed_at, notified_at, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO NOTHING`,
          [row.id, row.lead_id, row.description, row.due_date, row.completed,
           row.completed_at, row.notified_at, row.created_by, row.created_at]
        );
        insertedRem++;
      } catch (err) {
        if (insertedRem < 5) console.log(`   ⚠️  Reminder ${row.id}: ${err.message}`);
      }
    }
    console.log(`   ✅ ${insertedRem} reminders migrados`);

  } finally {
    src.release();
    tgt.release();
  }
}

async function main() {
  try {
    const sourceStats = await checkDatabase(sourcePool, "SOURCE (Render viejo)");

    if (mode === "--check") {
      if (TARGET_DB_URL) {
        const targetPool = new Pool({ connectionString: TARGET_DB_URL, ssl: { rejectUnauthorized: false } });
        await checkDatabase(targetPool, "TARGET (DB actual)");

        if (sourceStats) {
          console.log("\n📋 Si querés migrar, corré:");
          console.log('   SOURCE_DB_URL="..." TARGET_DB_URL="..." node scripts/migrate-crm-leads.mjs --migrate');
        }
        await targetPool.end();
      }
    }

    if (mode === "--migrate") {
      const targetPool = new Pool({ connectionString: TARGET_DB_URL, ssl: { rejectUnauthorized: false } });

      console.log("\n📊 Estado ANTES de migrar:");
      await checkDatabase(targetPool, "TARGET (DB actual)");

      await migrateData(sourcePool, targetPool);

      console.log("\n📊 Estado DESPUÉS de migrar:");
      await checkDatabase(targetPool, "TARGET (DB actual)");

      await targetPool.end();
    }

    await sourcePool.end();
    console.log("\n✅ Listo!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
