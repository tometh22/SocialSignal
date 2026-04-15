/**
 * Merge de leads CRM entre dos bases de datos (Render + Railway → unificada).
 *
 * Detecta duplicados por company_name (case-insensitive, trim).
 * Para duplicados: mantiene el lead del target, pero mergea contactos/actividades/reminders
 * que existan en source y no en target.
 * Para leads nuevos: los inserta con nuevo ID para evitar colisiones.
 *
 * Uso:
 *   # Solo diagnóstico — ver qué hay en cada DB y cuántos duplicados:
 *   RENDER_DB_URL="postgres://..." RAILWAY_DB_URL="postgres://..." node scripts/migrate-crm-leads.mjs --check
 *
 *   # Merge Render → Railway (Railway es la DB destino final):
 *   RENDER_DB_URL="postgres://..." RAILWAY_DB_URL="postgres://..." node scripts/migrate-crm-leads.mjs --merge
 *
 *   # Dry-run (muestra qué haría sin escribir):
 *   RENDER_DB_URL="postgres://..." RAILWAY_DB_URL="postgres://..." node scripts/migrate-crm-leads.mjs --dry-run
 */

import pg from "pg";
const { Pool } = pg;

const RENDER_DB_URL = process.env.RENDER_DB_URL;
const RAILWAY_DB_URL = process.env.RAILWAY_DB_URL;
const mode = process.argv[2]; // --check, --merge, or --dry-run

if (!RENDER_DB_URL || !RAILWAY_DB_URL) {
  console.error("❌ Faltan variables. Ejemplo:");
  console.error('   RENDER_DB_URL="postgres://..." RAILWAY_DB_URL="postgres://..." node scripts/migrate-crm-leads.mjs --check');
  process.exit(1);
}

if (!mode || !["--check", "--merge", "--dry-run"].includes(mode)) {
  console.error("❌ Usá --check, --dry-run o --merge");
  process.exit(1);
}

const renderPool = new Pool({ connectionString: RENDER_DB_URL, ssl: { rejectUnauthorized: false } });
const railwayPool = new Pool({ connectionString: RAILWAY_DB_URL, ssl: { rejectUnauthorized: false } });

function normalize(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function fetchAllData(pool, label) {
  const client = await pool.connect();
  try {
    console.log(`\n📊 === ${label} ===`);

    const tableCheck = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_leads') as exists
    `);
    if (!tableCheck.rows[0].exists) {
      console.log("   ⚠️  Tabla crm_leads NO existe");
      return null;
    }

    const leads = await client.query("SELECT * FROM crm_leads ORDER BY id");
    const contacts = await client.query("SELECT * FROM crm_contacts ORDER BY id");
    const activities = await client.query("SELECT * FROM crm_activities ORDER BY id");
    const reminders = await client.query("SELECT * FROM crm_reminders ORDER BY id");
    const stages = await client.query("SELECT * FROM crm_stages ORDER BY id");

    const byStage = await client.query(
      "SELECT stage, COUNT(*) as count FROM crm_leads GROUP BY stage ORDER BY count DESC"
    );

    console.log(`   Leads:       ${leads.rows.length}`);
    console.log(`   Contactos:   ${contacts.rows.length}`);
    console.log(`   Actividades: ${activities.rows.length}`);
    console.log(`   Reminders:   ${reminders.rows.length}`);
    console.log(`   Stages:      ${stages.rows.length}`);
    console.log(`   Por etapa:`);
    for (const row of byStage.rows) {
      console.log(`     ${row.stage}: ${row.count}`);
    }

    return {
      leads: leads.rows,
      contacts: contacts.rows,
      activities: activities.rows,
      reminders: reminders.rows,
      stages: stages.rows,
    };
  } finally {
    client.release();
  }
}

async function analyzeOverlap(renderData, railwayData) {
  const renderByName = new Map();
  for (const lead of renderData.leads) {
    const key = normalize(lead.company_name);
    if (!renderByName.has(key)) renderByName.set(key, []);
    renderByName.get(key).push(lead);
  }

  const railwayByName = new Map();
  for (const lead of railwayData.leads) {
    const key = normalize(lead.company_name);
    if (!railwayByName.has(key)) railwayByName.set(key, []);
    railwayByName.get(key).push(lead);
  }

  const duplicates = []; // exist in both
  const onlyRender = []; // only in Render
  const onlyRailway = []; // only in Railway

  for (const [key, renderLeads] of renderByName) {
    if (railwayByName.has(key)) {
      duplicates.push({ name: key, render: renderLeads, railway: railwayByName.get(key) });
    } else {
      onlyRender.push(...renderLeads);
    }
  }

  for (const [key, railwayLeads] of railwayByName) {
    if (!renderByName.has(key)) {
      onlyRailway.push(...railwayLeads);
    }
  }

  console.log("\n📋 === ANÁLISIS DE OVERLAP ===");
  console.log(`   Leads solo en Render:  ${onlyRender.length} (se van a agregar a Railway)`);
  console.log(`   Leads solo en Railway: ${onlyRailway.length} (se mantienen)`);
  console.log(`   Duplicados (mismo company_name): ${duplicates.length} (se mergean contactos/actividades)`);
  console.log(`   TOTAL después del merge: ${onlyRender.length + onlyRailway.length + duplicates.length} leads únicos`);

  if (duplicates.length > 0 && duplicates.length <= 30) {
    console.log("\n   Duplicados encontrados:");
    for (const d of duplicates) {
      console.log(`     "${d.render[0].company_name}" — Render ID: ${d.render.map(l=>l.id).join(',')} | Railway ID: ${d.railway.map(l=>l.id).join(',')}`);
    }
  }

  return { duplicates, onlyRender, onlyRailway };
}

async function mergeData(renderData, railwayData, analysis, isDryRun) {
  const tgt = await railwayPool.connect();

  try {
    await tgt.query("BEGIN");

    // 1. Merge custom stages from Render that don't exist in Railway
    console.log("\n🔄 Mergeando stages...");
    const railwayStageKeys = new Set(railwayData.stages.map(s => s.key));
    let stagesAdded = 0;
    for (const stage of renderData.stages) {
      if (!railwayStageKeys.has(stage.key)) {
        console.log(`   + Stage: "${stage.label}" (${stage.key})`);
        if (!isDryRun) {
          await tgt.query(
            `INSERT INTO crm_stages (key, label, color, position, is_active, follow_up_days, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (key) DO NOTHING`,
            [stage.key, stage.label, stage.color, stage.position, stage.is_active, stage.follow_up_days, stage.created_at]
          );
        }
        stagesAdded++;
      }
    }
    console.log(`   ✅ ${stagesAdded} stages nuevos ${isDryRun ? '(dry-run)' : 'agregados'}`);

    // Build contact/activity/reminder maps indexed by lead_id from Render
    const renderContactsByLead = new Map();
    for (const c of renderData.contacts) {
      if (!renderContactsByLead.has(c.lead_id)) renderContactsByLead.set(c.lead_id, []);
      renderContactsByLead.get(c.lead_id).push(c);
    }
    const renderActivitiesByLead = new Map();
    for (const a of renderData.activities) {
      if (!renderActivitiesByLead.has(a.lead_id)) renderActivitiesByLead.set(a.lead_id, []);
      renderActivitiesByLead.get(a.lead_id).push(a);
    }
    const renderRemindersByLead = new Map();
    for (const r of renderData.reminders) {
      if (!renderRemindersByLead.has(r.lead_id)) renderRemindersByLead.set(r.lead_id, []);
      renderRemindersByLead.get(r.lead_id).push(r);
    }

    // Existing contacts/activities in Railway indexed by lead_id for dedup
    const railwayContactsByLead = new Map();
    for (const c of railwayData.contacts) {
      if (!railwayContactsByLead.has(c.lead_id)) railwayContactsByLead.set(c.lead_id, []);
      railwayContactsByLead.get(c.lead_id).push(c);
    }
    const railwayActivitiesByLead = new Map();
    for (const a of railwayData.activities) {
      if (!railwayActivitiesByLead.has(a.lead_id)) railwayActivitiesByLead.set(a.lead_id, []);
      railwayActivitiesByLead.get(a.lead_id).push(a);
    }

    // 2. Insert leads that only exist in Render (new IDs to avoid collision)
    console.log("\n🔄 Insertando leads exclusivos de Render...");
    let leadsInserted = 0;
    const renderIdToRailwayId = new Map(); // old Render ID → new Railway ID

    for (const lead of analysis.onlyRender) {
      if (!isDryRun) {
        const result = await tgt.query(
          `INSERT INTO crm_leads (company_name, stage, source, estimated_value_usd, notes,
             lost_reason, won_at, lost_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id`,
          [lead.company_name, lead.stage, lead.source, lead.estimated_value_usd, lead.notes,
           lead.lost_reason, lead.won_at, lead.lost_at, lead.created_at, lead.updated_at]
        );
        renderIdToRailwayId.set(lead.id, result.rows[0].id);
      } else {
        renderIdToRailwayId.set(lead.id, `NEW-${lead.id}`);
      }
      leadsInserted++;
    }
    console.log(`   ✅ ${leadsInserted} leads insertados ${isDryRun ? '(dry-run)' : ''}`);

    // 3. For duplicates, map Render lead IDs to existing Railway lead IDs
    for (const dup of analysis.duplicates) {
      // Map each Render lead to the first matching Railway lead
      for (const renderLead of dup.render) {
        renderIdToRailwayId.set(renderLead.id, dup.railway[0].id);
      }
    }

    // 4. Migrate contacts from Render leads (both new and duplicates)
    console.log("\n🔄 Mergeando contactos...");
    let contactsInserted = 0;
    let contactsSkipped = 0;

    for (const [renderLeadId, railwayLeadId] of renderIdToRailwayId) {
      const renderContacts = renderContactsByLead.get(renderLeadId) || [];
      const existingContacts = railwayContactsByLead.get(railwayLeadId) || [];
      const existingEmails = new Set(existingContacts.map(c => normalize(c.email || "")));
      const existingNames = new Set(existingContacts.map(c => normalize(c.name)));

      for (const contact of renderContacts) {
        const emailKey = normalize(contact.email || "");
        const nameKey = normalize(contact.name);

        // Skip if same email or same name already exists on this lead
        if ((emailKey && existingEmails.has(emailKey)) || existingNames.has(nameKey)) {
          contactsSkipped++;
          continue;
        }

        if (!isDryRun) {
          await tgt.query(
            `INSERT INTO crm_contacts (lead_id, name, email, phone, position, is_primary, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [railwayLeadId, contact.name, contact.email, contact.phone, contact.position,
             // Don't set as primary if target already has contacts
             existingContacts.length > 0 ? false : contact.is_primary,
             contact.created_at]
          );
        }
        contactsInserted++;
      }
    }
    console.log(`   ✅ ${contactsInserted} contactos insertados, ${contactsSkipped} duplicados saltados ${isDryRun ? '(dry-run)' : ''}`);

    // 5. Migrate activities
    console.log("\n🔄 Mergeando actividades...");
    let activitiesInserted = 0;
    let activitiesSkipped = 0;

    for (const [renderLeadId, railwayLeadId] of renderIdToRailwayId) {
      const renderActs = renderActivitiesByLead.get(renderLeadId) || [];
      const existingActs = railwayActivitiesByLead.get(railwayLeadId) || [];
      // Dedup by type + title + date (within same minute)
      const existingKeys = new Set(existingActs.map(a => {
        const d = a.activity_date ? new Date(a.activity_date).toISOString().slice(0, 16) : "";
        return `${a.type}|${normalize(a.title || "")}|${d}`;
      }));

      for (const act of renderActs) {
        const d = act.activity_date ? new Date(act.activity_date).toISOString().slice(0, 16) : "";
        const key = `${act.type}|${normalize(act.title || "")}|${d}`;

        if (existingKeys.has(key)) {
          activitiesSkipped++;
          continue;
        }

        if (!isDryRun) {
          await tgt.query(
            `INSERT INTO crm_activities (lead_id, type, title, content, activity_date, email_metadata, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [railwayLeadId, act.type, act.title, act.content, act.activity_date,
             act.email_metadata, act.created_at]
          );
        }
        activitiesInserted++;
      }
    }
    console.log(`   ✅ ${activitiesInserted} actividades insertadas, ${activitiesSkipped} duplicadas saltadas ${isDryRun ? '(dry-run)' : ''}`);

    // 6. Migrate reminders
    console.log("\n🔄 Mergeando reminders...");
    let remindersInserted = 0;

    for (const [renderLeadId, railwayLeadId] of renderIdToRailwayId) {
      const renderRems = renderRemindersByLead.get(renderLeadId) || [];

      for (const rem of renderRems) {
        if (!isDryRun) {
          await tgt.query(
            `INSERT INTO crm_reminders (lead_id, description, due_date, completed, completed_at, notified_at, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [railwayLeadId, rem.description, rem.due_date, rem.completed,
             rem.completed_at, rem.notified_at, rem.created_at]
          );
        }
        remindersInserted++;
      }
    }
    console.log(`   ✅ ${remindersInserted} reminders insertados ${isDryRun ? '(dry-run)' : ''}`);

    if (isDryRun) {
      await tgt.query("ROLLBACK");
      console.log("\n⚠️  DRY-RUN: no se escribió nada. Usá --merge para ejecutar.");
    } else {
      await tgt.query("COMMIT");
      console.log("\n✅ COMMIT exitoso.");
    }

  } catch (err) {
    await tgt.query("ROLLBACK");
    throw err;
  } finally {
    tgt.release();
  }
}

async function main() {
  try {
    const renderData = await fetchAllData(renderPool, "RENDER (DB vieja)");
    const railwayData = await fetchAllData(railwayPool, "RAILWAY (DB actual)");

    if (!renderData || !railwayData) {
      console.error("❌ Una de las bases no tiene tablas CRM.");
      process.exit(1);
    }

    const analysis = await analyzeOverlap(renderData, railwayData);

    if (mode === "--check") {
      console.log("\n📋 Próximos pasos:");
      console.log("   1. Corré con --dry-run para ver exactamente qué se haría");
      console.log("   2. Si todo OK, corré con --merge para ejecutar");
    }

    if (mode === "--dry-run") {
      await mergeData(renderData, railwayData, analysis, true);
    }

    if (mode === "--merge") {
      await mergeData(renderData, railwayData, analysis, false);

      console.log("\n📊 Estado FINAL de Railway:");
      await fetchAllData(railwayPool, "RAILWAY (después del merge)");
    }

    await renderPool.end();
    await railwayPool.end();
    console.log("\n✅ Listo!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
