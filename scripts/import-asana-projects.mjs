/** Controlled, transactional data migration. Defaults to a read-only preview.
 * DATABASE_URL is supplied by the release operator. No credentials or source
 * exports belong in git. Manifest paths are relative to the manifest directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {parseAsanaTasks} from './lib/asana-task-csv.mjs';

const args=process.argv.slice(2),apply=args.includes('--apply');
const manifestPath=args.find(arg=>!arg.startsWith('--'));
if(!manifestPath || !process.env.DATABASE_URL) throw new Error('Uso: DATABASE_URL=… node scripts/import-asana-projects.mjs manifest.json [--apply]');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});
await db.connect();
try {
 await db.query(apply?'BEGIN':'BEGIN READ ONLY');
 if(apply) await db.query("SELECT pg_advisory_xact_lock(hashtext('mind-asana-project-migration'))");
 const people=(await db.query('SELECT id,name,email FROM personnel ORDER BY id')).rows;
 const projects=(await db.query('SELECT * FROM active_projects ORDER BY id')).rows;
 const quotes=(await db.query('SELECT id,client_id FROM quotations')).rows;
 const clients=(await db.query('SELECT id,name FROM clients')).rows;
 const mappings=manifest.personAliases || {};
 const resolvePerson=(name,email)=>{
   if(!name&&!email)return null;
   const explicit=mappings[normalize(name)];
   const matches=people.filter(p=>explicit?p.id===explicit:(email&&p.email?.toLowerCase()===email.toLowerCase())||normalize(p.name)===normalize(name));
   const ids=[...new Set(matches.map(p=>p.id))];
   if(ids.length!==1) throw new Error(`No hay una persona única para ${name} (${email || 'sin email'})`);
   return ids[0];
 };
 const prepared=manifest.projects.map(p=>{
   if(!/^\d+$/.test(p.gid)||!p.name||!(Number.isSafeInteger(p.clientId)||(p.clientId===null&&p.clientConfirmed===false)))throw new Error('Proyecto inválido en manifiesto');
   const current=projects.find(x=>x.asana_project_gid===p.gid)||projects.find(x=>x.id===p.targetProjectId);
   if(p.targetProjectId&&!current)throw new Error(`Proyecto destino inexistente: ${p.targetProjectId}`);
   if(current?.asana_project_gid&&current.asana_project_gid!==p.gid)throw new Error(`Proyecto destino ya vinculado a otro GID: ${p.name}`);
   if(current?.quotation_id&&p.quotationId&&current.quotation_id!==p.quotationId)throw new Error(`Cotización destino incompatible: ${p.name}`);
   if(p.clientId!==null&&!clients.some(c=>c.id===p.clientId))throw new Error(`Cliente inexistente: ${p.clientId}`);
   for(const legacy of p.history||[])if(!projects.some(x=>x.id===legacy.id))throw new Error(`Historial inexistente: ${legacy.id}`);
   if(current && (p.clientId===null ? !clients.some(c=>c.id===current.client_id&&c.name==='Asana · cliente pendiente de confirmar') : current.client_id!==p.clientId))throw new Error(`Cliente incompatible en ${p.name}`);
   for(const q of [p.quotationId,...(p.additionalQuotations||[]).map(x=>x.id)].filter(Boolean))if(!quotes.some(x=>x.id===q&&x.client_id===p.clientId))throw new Error(`Cotización incompatible: ${q}`);
   const csv=p.tasksFile?fs.readFileSync(path.resolve(path.dirname(manifestPath),p.tasksFile),'utf8'):null;
   const parsed=csv?parseAsanaTasks(csv):null;
   if(current?.asana_source?.sourceHash&&csv&&current.asana_source.sourceHash!==createHash('sha256').update(csv).digest('hex'))throw new Error(`La fuente de ${p.name} cambió; requiere conciliación explícita`);
   if(parsed)for(const task of parsed.tasks)task.assigneeId=resolvePerson(task.assigneeName,task.assigneeEmail);
   return {...p,current,parsed,hash:csv?createHash('sha256').update(csv).digest('hex'):null};
 });
 if(new Set(prepared.map(p=>p.gid)).size!==prepared.length)throw new Error('GID de proyecto duplicado');
 if(new Set(prepared.map(p=>p.targetProjectId).filter(Boolean)).size!==prepared.filter(p=>p.targetProjectId).length)throw new Error('Proyecto destino duplicado');
 // Unconfirmed client identities remain visibly separate from real client accounts.
 if(apply&&prepared.some(p=>p.clientId===null)){
   const holding=(await db.query("INSERT INTO clients(name) VALUES('Asana · cliente pendiente de confirmar') ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id")).rows[0];
   for(const p of prepared)if(p.clientId===null)p.clientId=holding.id;
 }
 const report={at:new Date().toISOString(),applied:apply,projects:[],nativeDataPreserved:true,quotesPricesPreserved:true,detailedTimeImported:0};
 for(const p of prepared){
   let projectId=p.current?.id;
   const source={source:'asana-csv',name:p.name,sourceHash:p.hash,tasksAvailable:Boolean(p.parsed)||p.current?.asana_source?.tasksAvailable===true,detailedHoursAvailable:p.current?.asana_source?.detailedHoursAvailable===true,clientConfirmed:p.clientConfirmed!==false,capturedAt:manifest.capturedAt,reportedConsumedCost:p.reportedConsumedCost||null};
   if(apply){
     if(!projectId){ const r=await db.query('INSERT INTO active_projects (name,client_id,quotation_id,status,project_category,internal_type,workflow_stage,asana_project_gid,asana_source,task_section_names) VALUES ($1,$2,$3,\'active\',$4,$5,\'empezado\',$6,$7,$8) RETURNING id',[p.name,p.clientId,p.quotationId||null,p.category,p.category==='internal'?'general':null,p.gid,source,JSON.stringify([...new Set(p.parsed?.tasks.map(t=>t.section)||[])])]);projectId=r.rows[0].id; }
     else await db.query('UPDATE active_projects SET asana_project_gid=$2,asana_source=$3,quotation_id=COALESCE($4,quotation_id) WHERE id=$1',[projectId,p.gid,source,p.quotationId||null]);
     for(const q of [{id:p.quotationId,relation:'primary'},...(p.additionalQuotations||[])].filter(q=>q.id))await db.query('INSERT INTO project_quotation_links(project_id,quotation_id,relation,source) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,quotation_id) DO NOTHING',[projectId,q.id,q.relation,'excel-and-asana-20261002']);
     for(const legacy of p.history || [])await db.query('INSERT INTO project_history_links(project_id,legacy_project_id,relation,source) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,legacy_project_id) DO NOTHING',[projectId,legacy.id,legacy.relation,'excel-and-asana-20261002']);
   }
   let inserted=0,reused=0,skipped=0;
   if(p.parsed && apply){
     const existing=(await db.query('SELECT * FROM tasks WHERE project_id=$1 ORDER BY id',[projectId])).rows;
     const ids=new Map(),used=new Set(),pending=[];
     for(const task of p.parsed.tasks){
       let current=existing.find(t=>t.asana_task_gid===task.gid);
       if(current){ids.set(task.gid,current.id);used.add(current.id);skipped++;continue;} // Repeat imports preserve subsequent Mind edits.
       const candidates=existing.filter(t=>!t.asana_task_gid&&!used.has(t.id)&&t.title.trim()===task.title.trim()&&t.assignee_id===task.assigneeId&&t.section_name===task.section);
       current=candidates.length===1?candidates[0]:null;
       const metadata={actualMinutes:task.actualMinutes,parentResolution:task.parentResolution,parentName:task.parentName,raw:task.raw,sourceDuplicates:task.sourceDuplicates,sourceHash:p.hash,capturedAt:manifest.capturedAt};
       if(current){
         // Excel scaffolds have no dates or recorded work. Preserve edited native tasks.
         const pristine=current.status==='todo'&&!current.start_date&&!current.due_date&&!Number(current.logged_hours);
         await db.query('UPDATE tasks SET asana_task_gid=$2,asana_source=$3,start_date=CASE WHEN $4 THEN $5 ELSE start_date END,due_date=CASE WHEN $4 THEN $6 ELSE due_date END,status=CASE WHEN $4 THEN $7 ELSE status END,completed_at=CASE WHEN $4 THEN $8 ELSE completed_at END WHERE id=$1',[current.id,task.gid,metadata,pristine,task.startDate,task.dueDate,task.status,task.completedAt]);ids.set(task.gid,current.id);used.add(current.id);reused++;
       }
       else pending.push({task,metadata});
     }
     // Insert new source rows together to avoid thousands of network round trips.
     if(pending.length){
       const rows=pending.map(({task,metadata})=>({...task,metadata,projectId}));
       const result=await db.query(`INSERT INTO tasks(title,description,project_id,section_name,assignee_id,start_date,due_date,status,completed_at,created_at,position,asana_task_gid,asana_source)
         SELECT title,description,"projectId",section,"assigneeId","startDate"::timestamp,"dueDate"::timestamp,status,"completedAt"::timestamp,COALESCE("createdAt"::timestamp,now()),position,gid,metadata
         FROM jsonb_to_recordset($1::jsonb) AS x(title text,description text,"projectId" int,section text,"assigneeId" int,"startDate" text,"dueDate" text,status text,"completedAt" text,"createdAt" text,position int,gid text,metadata jsonb)
         RETURNING id,asana_task_gid`,[JSON.stringify(rows)]);
       for(const r of result.rows)ids.set(r.asana_task_gid,r.id);
       inserted=result.rowCount;
     }
     // Only freshly inserted tasks take the source hierarchy. Reused Excel tasks retain their existing hierarchy, notes, and dates.
     const nativeIds=new Set(existing.map(t=>t.id));
     const parents=p.parsed.tasks.filter(task=>task.parentGid&&!nativeIds.has(ids.get(task.gid))).map(task=>({id:ids.get(task.gid),parent:ids.get(task.parentGid)}));
     if(parents.length)await db.query('UPDATE tasks t SET parent_task_id=x.parent FROM jsonb_to_recordset($1::jsonb) AS x(id int,parent int) WHERE t.id=x.id',[JSON.stringify(parents)]);
     const sections=[...new Set([...(p.current?.task_section_names||[]),...p.parsed.tasks.map(t=>t.section)])];
     await db.query('UPDATE active_projects SET task_section_names=$2 WHERE id=$1',[projectId,JSON.stringify(sections)]);
     for(const id of [...new Set(p.parsed.tasks.map(t=>t.assigneeId).filter(Boolean))])await db.query('INSERT INTO task_project_members(project_id,personnel_id,role) VALUES($1,$2,\'member\') ON CONFLICT DO NOTHING',[projectId,id]);
     const client=(await db.query('SELECT name FROM clients WHERE id=$1',[p.clientId])).rows[0];
     if(p.clientConfirmed!==false)await db.query('INSERT INTO project_aliases(project_id,excel_client,excel_project,source,confidence,is_active,notes) SELECT $1,$2::varchar,$3::varchar,\'asana_migration\',1,true,\'Exact Asana project name\' WHERE NOT EXISTS(SELECT 1 FROM project_aliases WHERE is_active AND LOWER(excel_client)=LOWER($2::varchar) AND LOWER(excel_project)=LOWER($3::varchar))',[projectId,client.name,p.name]);
   }
   report.projects.push({gid:p.gid,name:p.name,projectId,tasksAvailable:Boolean(p.parsed),clientConfirmed:p.clientConfirmed!==false,sourceTasks:p.parsed?.tasks.length||0,sourceActualMinutes:p.parsed?.tasks.reduce((sum,t)=>sum+(t.actualMinutes||0),0)||0,inserted,reused,skipped,duplicateSourceRows:p.parsed?.duplicateRows||0,unresolvedParents:p.parsed?.unresolvedParents||[],detailedHoursAvailable:false});
 }
 await db.query(apply?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify(report,null,2));
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
