/** Second-stage source reconciliation: exact parent IDs, original people and
 * attributed time. Source time never creates a second financial expense.
 * Preview is read-only; --apply is atomic and repeatable. */
import fs from 'node:fs';import path from 'node:path';import pg from 'pg';import {createHash} from 'node:crypto';
import {parseAsanaTaskJson,parseAsanaTimeJson} from './lib/asana-task-json.mjs';
import {parseAsanaTasks} from './lib/asana-task-csv.mjs';
const args=process.argv.slice(2),apply=args.includes('--apply'),file=args.find(a=>!a.startsWith('--'));
if(!file||!process.env.DATABASE_URL)throw new Error('Manifest and DATABASE_URL required');
const manifest=JSON.parse(fs.readFileSync(file,'utf8')),dir=path.dirname(file),read=name=>JSON.parse(fs.readFileSync(path.resolve(dir,name),'utf8'));
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});await db.connect();
try{
 await db.query(apply?'BEGIN':'BEGIN READ ONLY');if(apply)await db.query("SELECT pg_advisory_xact_lock(hashtext('mind-asana-project-migration'))");
 const projects=(await db.query('SELECT * FROM active_projects')).rows,people=(await db.query('SELECT id,name,email FROM personnel')).rows;
 const owners=(await db.query("SELECT project_id,personnel_id FROM task_project_members WHERE role='owner'")).rows;
 const identities=read(manifest.usersFile).data.map(raw=>{const alias=manifest.personAliases?.[normal(raw.name)];const matches=people.filter(p=>alias?p.id===alias:(raw.email&&p.email?.toLowerCase()===raw.email.toLowerCase())||normal(p.name)===normal(raw.name));return{gid:raw.gid,name:raw.name,email:raw.email||null,personnelId:matches.length===1?matches[0].id:null,raw};});
 if(new Set(identities.map(u=>u.gid)).size!==identities.length)throw new Error('Duplicate identity GID');
 const users=new Map(identities.map(u=>[u.gid,u]));
 const prepared=manifest.projects.map(p=>{
  const current=projects.find(x=>x.asana_project_gid===p.gid);if(!current)throw new Error('Project GID not registered: '+p.gid);
  const doc=read(p.jsonTasksFile),parsed=parseAsanaTaskJson(doc,p.gid),time=parseAsanaTimeJson(read(p.timeFile),p.gid),project=read(p.projectFile).data,sections=read(p.sectionsFile).data;
  if(project.gid!==p.gid||project.archived||project.completed)throw new Error('Project outside active scope: '+p.gid);
  const csv=p.tasksFile?parseAsanaTasks(fs.readFileSync(path.resolve(dir,p.tasksFile),'utf8')):null;
  for(const t of parsed.tasks){t.assigneeId=users.get(t.assigneeGid)?.personnelId||null;t.collaborators=t.followerGids.map(g=>users.get(g)?.personnelId).filter(Boolean);}
  for(const t of time)if(t.authorGid&&!users.has(t.authorGid))throw new Error('Time author absent from original roster');
  return{...p,current,parsed,time,project,sections,csv,hash:createHash('sha256').update(JSON.stringify(doc)).digest('hex')};
 });
 if(new Set(prepared.map(p=>p.gid)).size!==prepared.length)throw new Error('Duplicate project GID');
 const allTime=prepared.flatMap(p=>p.time);if(new Set(allTime.map(t=>t.gid)).size!==allTime.length)throw new Error('Duplicate attributed time GID');
 const hasTimeTable=(await db.query("SELECT to_regclass('public.asana_time_entries') AS name")).rows[0].name;
 if(hasTimeTable){const saved=new Map((await db.query('SELECT gid,source FROM asana_time_entries')).rows.map(t=>[t.gid,t.source]));for(const t of allTime){const old=saved.get(t.gid);if(old&&[old.duration_minutes!==t.raw.duration_minutes,old.entered_on!==t.raw.entered_on,old.attributable_to?.gid!==t.raw.attributable_to?.gid,old.created_by?.gid!==t.raw.created_by?.gid].some(Boolean))throw new Error('Las horas originales cambiaron: '+t.gid+'; requieren conciliación explícita');}}
 const report={applied:apply,at:new Date().toISOString(),identities:identities.length,unresolvedIdentities:identities.filter(u=>!u.personnelId).map(u=>({gid:u.gid,name:u.name})),financialFactsUnchanged:true,projects:[]};
 if(apply){
  await db.query(`INSERT INTO asana_person_identities(gid,name,email,personnel_id,source) SELECT gid,name,email,"personnelId",raw FROM jsonb_to_recordset($1::jsonb) AS x(gid text,name text,email text,"personnelId" int,raw jsonb) ON CONFLICT(gid) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,personnel_id=COALESCE(asana_person_identities.personnel_id,EXCLUDED.personnel_id)`,[JSON.stringify(identities)]);
 }
 for(const p of prepared){
  const projectId=p.current.id,existing=(await db.query('SELECT * FROM tasks WHERE project_id=$1 ORDER BY id',[projectId])).rows,ids=new Map(existing.filter(t=>t.asana_task_gid).map(t=>[t.asana_task_gid,t.id]));
  const priorGids=new Set(p.current.asana_source?.importedTaskGids||(p.csv?.tasks||[]).map(t=>t.gid));
  const retiredGids=new Set([...(p.current.asana_source?.retiredTaskGids||[]).filter(gid=>!ids.has(gid)),...p.parsed.tasks.filter(t=>priorGids.has(t.gid)&&!ids.has(t.gid)).map(t=>t.gid)]);
  const retiredTasks=p.parsed.tasks.filter(t=>retiredGids.has(t.gid));
  const newTasks=p.parsed.tasks.filter(t=>!ids.has(t.gid)&&!retiredGids.has(t.gid)),byGid=new Map(existing.filter(t=>t.asana_task_gid).map(t=>[t.asana_task_gid,t]));
  let archiveId=p.current.asana_source?.retiredTaskArchiveProjectId||null,archivedNew=0;
  const destinations=new Map(existing.filter(t=>t.asana_task_gid).map(t=>[t.asana_task_gid,projectId]));
  let linkedHours=0,newTime=0;
  if(apply){
   if(retiredTasks.length){
    if(!archiveId){const archive=(await db.query("INSERT INTO active_projects(name,client_id,status,project_category,internal_type,notes,task_section_names) VALUES($1,$2,'voided','internal','general',$3,$4) RETURNING id",[p.project.name+' · historial recuperable',p.current.client_id,'Resguardo de tareas importadas anteriormente que ya no estaban en Mind al conciliar Asana. Se conserva el retiro de la vista activa.',JSON.stringify([...new Set(retiredTasks.map(t=>t.section))])])).rows[0];archiveId=archive.id;}
    const archived=(await db.query('SELECT * FROM tasks WHERE project_id=$1',[archiveId])).rows;
    for(const t of archived)if(t.asana_task_gid){ids.set(t.asana_task_gid,t.id);byGid.set(t.asana_task_gid,t);destinations.set(t.asana_task_gid,archiveId);}
   }
   async function insertTasks(rows,destination){if(!rows.length)return 0;
    const result=await db.query(`INSERT INTO tasks(title,description,project_id,section_name,assignee_id,collaborator_ids,start_date,due_date,status,completed_at,created_at,position,is_milestone,asana_task_gid,asana_source)
    SELECT title,description,$2,section,"assigneeId",collaborators,"startDate"::timestamp,"dueDate"::timestamp,status,"completedAt"::timestamp,COALESCE("createdAt"::timestamp,now()),position,"isMilestone",gid,jsonb_build_object('format','asana-json','actualMinutes',"actualMinutes",'raw',raw,'parentResolution',"parentResolution",'parentName',"parentName",'parentGid',"parentGid",'assigneeGid',"assigneeGid",'assigneeName',"assigneeName")
    FROM jsonb_to_recordset($1::jsonb) AS x(title text,description text,section text,"assigneeId" int,collaborators jsonb,"startDate" text,"dueDate" text,status text,"completedAt" text,"createdAt" text,position int,"isMilestone" bool,gid text,"actualMinutes" int,raw jsonb,"parentResolution" text,"parentName" text,"parentGid" text,"assigneeGid" text,"assigneeName" text) RETURNING id,asana_task_gid`,[JSON.stringify(rows),destination]);for(const t of result.rows){ids.set(t.asana_task_gid,t.id);destinations.set(t.asana_task_gid,destination);}return result.rowCount;
   }
   await insertTasks(newTasks,projectId);
   if(archiveId)archivedNew=await insertTasks(retiredTasks.filter(t=>!ids.has(t.gid)),archiveId);
   // Existing CSV tasks keep native edits. Correct only the hierarchy which
   // still matches the previous export; an edited hierarchy is retained.
   const oldParents=new Map((p.csv?.tasks||[]).map(t=>[t.gid,ids.get(t.parentGid)||null]));
   const updates=p.parsed.tasks.map(t=>{const old=byGid.get(t.gid);const editable=!old||old.asana_source?.format!=='asana-json'&&old.parent_task_id===(oldParents.get(t.gid)??null);const sameProject=destinations.get(t.gid)===destinations.get(t.parentGid);const resolvedParent=sameProject?ids.get(t.parentGid)||null:null;const resolvedLabel=t.parentGid&&!sameProject&&ids.has(t.parentGid)?'retired_parent':t.parentResolution;return{id:ids.get(t.gid),parent:editable?resolvedParent:old.parent_task_id,source:{...old?.asana_source,csvRaw:old?.asana_source?.csvRaw||(old?.asana_source?.raw?.['Task ID']?old.asana_source.raw:undefined),format:'asana-json',actualMinutes:t.actualMinutes,raw:t.raw,retiredInMind:retiredGids.has(t.gid),originalProjectGid:p.gid,parentResolution:editable?resolvedLabel:(old.parent_task_id===resolvedParent?resolvedLabel:'preserved_native'),parentName:t.parentName,parentGid:t.parentGid,assigneeGid:t.assigneeGid,assigneeName:t.assigneeName,sourceHash:p.hash,capturedAt:manifest.capturedAt},milestone:old?.asana_source?.format==='asana-json'?old.is_milestone:(t.isMilestone||old?.is_milestone||false)};});
   if(updates.length)await db.query('UPDATE tasks t SET parent_task_id=x.parent,asana_source=x.source,is_milestone=x.milestone FROM jsonb_to_recordset($1::jsonb) AS x(id int,parent int,source jsonb,milestone bool) WHERE t.id=x.id',[JSON.stringify(updates)]);
   const memberIds=[...new Set([...p.project.members.map(u=>users.get(u.gid)?.personnelId),...p.parsed.tasks.flatMap(t=>[t.assigneeId,...t.collaborators]),...p.time.map(t=>users.get(t.authorGid)?.personnelId)].filter(Boolean))];
   if(memberIds.length)await db.query("INSERT INTO task_project_members(project_id,personnel_id,role) SELECT $1,unnest($2::int[]),'member' ON CONFLICT DO NOTHING",[projectId,memberIds]);
   if(archiveId&&memberIds.length)await db.query("INSERT INTO task_project_members(project_id,personnel_id,role) SELECT $1,unnest($2::int[]),'member' ON CONFLICT DO NOTHING",[archiveId,memberIds]);
   const owner=users.get(p.project.owner?.gid)?.personnelId||null;
   if(owner&&!owners.some(m=>m.project_id===projectId)){await db.query("INSERT INTO task_project_members(project_id,personnel_id,role) VALUES($1,$2,'owner') ON CONFLICT(project_id,personnel_id) DO UPDATE SET role='owner'",[projectId,owner]);}
   const sections=[...new Set([...p.sections.map(s=>s.name||'General'),...(p.current.task_section_names||[]),...p.parsed.tasks.map(t=>t.section)])];
   await db.query('UPDATE active_projects SET task_section_names=$2,asana_source=$3 WHERE id=$1',[projectId,JSON.stringify(sections),{...p.current.asana_source,format:'asana-json',tasksAvailable:true,detailedHoursAvailable:true,sourceHash:p.hash,capturedAt:manifest.capturedAt,originalProject:p.project,originalSections:p.sections,importedTaskGids:[...new Set([...priorGids,...p.parsed.tasks.map(t=>t.gid)])],retiredTaskGids:[...retiredGids],retiredTaskArchiveProjectId:archiveId,unresolvedPeople:p.project.members.filter(u=>!users.get(u.gid)?.personnelId).map(u=>({gid:u.gid,name:u.name}))}]);
   const rows=p.time.map(t=>({...t,taskId:ids.get(t.taskGid)||null,personnelId:users.get(t.authorGid)?.personnelId||null}));
   if(rows.length){
    const result=await db.query(`INSERT INTO asana_time_entries(gid,project_id,task_id,personnel_id,source_task_gid,source_task_name,author_gid,author_name,date,minutes,description,source,source_created_at)
    SELECT gid,$2,"taskId","personnelId","taskGid","taskName","authorGid","authorName",date::timestamp,minutes,description,raw,"createdAt"::timestamp FROM jsonb_to_recordset($1::jsonb) AS x(gid text,"taskId" int,"personnelId" int,"taskGid" text,"taskName" text,"authorGid" text,"authorName" text,date text,minutes int,description text,raw jsonb,"createdAt" text) ON CONFLICT(gid) DO UPDATE SET task_id=COALESCE(asana_time_entries.task_id,EXCLUDED.task_id),personnel_id=COALESCE(asana_time_entries.personnel_id,EXCLUDED.personnel_id) WHERE (asana_time_entries.task_id IS NULL AND EXCLUDED.task_id IS NOT NULL) OR (asana_time_entries.personnel_id IS NULL AND EXCLUDED.personnel_id IS NOT NULL) RETURNING gid,(xmax=0) AS inserted`,[JSON.stringify(rows),projectId]);newTime=result.rows.filter(r=>r.inserted).length;
   }
   linkedHours=rows.filter(r=>r.taskId).length;
  }
  report.projects.push({gid:p.gid,projectId,name:p.project.name,retiredTasks:retiredTasks.length,retiredTaskArchiveProjectId:archiveId,archivedNew,sourceTasks:p.parsed.tasks.length,newTasks:newTasks.length,sourceTime:p.time.length,newTime,linkedTime:apply?linkedHours:p.time.filter(t=>p.parsed.tasks.some(x=>x.gid===t.taskGid)).length,sourceMinutes:p.time.reduce((s,t)=>s+t.minutes,0),unresolvedParents:p.parsed.unresolvedParents,unknownAssignees:p.parsed.tasks.filter(t=>t.assigneeGid&&!t.assigneeId).map(t=>({gid:t.gid,name:t.assigneeName})),unresolvedOwner:p.project.owner&&!users.get(p.project.owner.gid)?.personnelId? p.project.owner.name:null,priorNativeTasks:existing.filter(t=>!t.asana_task_gid).length});
 }
 await db.query(apply?'COMMIT':'ROLLBACK');console.log(JSON.stringify(report,null,2));
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end()}
