import { civilDate } from './asana-task-csv.mjs';
const gid=value=>typeof value==='string'&&/^\d+$/.test(value);
const instant=value=>{if(!value)return null;const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('Timestamp Asana inválido');return date.toISOString()};
export function parseAsanaTaskJson(document,projectGid){
 if(!Array.isArray(document.data)||document.next_page)throw new Error('Exportación JSON incompleta');
 const seen=new Map();
 function walk(raw){
  if(!gid(raw.gid)||typeof raw.name!=='string')throw new Error('Subtarea incompleta o GID inválido');
  if(!seen.has(raw.gid))seen.set(raw.gid,raw);
  for(const child of raw.subtasks||[])walk(child);
 }
 document.data.forEach(walk);
 const tasks=[...seen.values()].map((raw,position)=>{
  if(raw.actual_time_minutes!=null&&(!Number.isSafeInteger(raw.actual_time_minutes)||raw.actual_time_minutes<0))throw new Error('Minutos Asana inválidos');
  const {subtasks,...record}=raw;
  return{gid:raw.gid,title:raw.name,description:raw.notes||null,assigneeGid:raw.assignee?.gid||null,assigneeName:raw.assignee?.name||null,followerGids:(raw.followers||[]).map(u=>u.gid),section:raw.memberships?.find(m=>m.project?.gid===projectGid)?.section?.name||null,startDate:raw.start_on?civilDate(raw.start_on):instant(raw.start_at),dueDate:raw.due_on?civilDate(raw.due_on):instant(raw.due_at),completedAt:instant(raw.completed_at),createdAt:instant(raw.created_at),status:raw.completed?'done':'todo',actualMinutes:raw.actual_time_minutes??null,parentGid:raw.parent?.gid||null,parentName:raw.parent?.name||null,isMilestone:raw.resource_subtype==='milestone',position,raw:{...record,subtaskIds:(subtasks||[]).map(t=>t.gid)}};
 });
 const byId=new Map(tasks.map(t=>[t.gid,t])),visiting=new Set(),visited=new Set();
 function visit(t){if(visiting.has(t.gid))throw new Error('Ciclo de subtareas Asana');if(visited.has(t.gid))return;visiting.add(t.gid);const parent=byId.get(t.parentGid);if(parent){visit(parent);t.section ||= parent.section;}t.section ||= 'General';t.parentResolution=t.parentGid?(parent?'resolved':'missing'):'none';visiting.delete(t.gid);visited.add(t.gid);}
 tasks.forEach(visit);return{tasks,unresolvedParents:tasks.filter(t=>t.parentResolution==='missing').map(t=>({gid:t.gid,parentGid:t.parentGid,parentName:t.parentName}))};
}
export function parseAsanaTimeJson(document,projectGid){
 if(!Array.isArray(document.data)||document.next_page)throw new Error('Exportación de horas incompleta');
 const seen=new Set();return document.data.map(raw=>{
  if(!gid(raw.gid)||seen.has(raw.gid)||raw.attributable_to?.gid!==projectGid)throw new Error('ID o atribución de horas incompatible');seen.add(raw.gid);
  if(!Number.isSafeInteger(raw.duration_minutes)||raw.duration_minutes<0)throw new Error('Duración de horas inválida');
  if(!raw.entered_on)throw new Error('Fecha de horas no disponible');
  return{gid:raw.gid,taskGid:raw.task?.gid||null,taskName:raw.task?.name||null,authorGid:raw.created_by?.gid||null,authorName:raw.created_by?.name||null,date:civilDate(raw.entered_on),minutes:raw.duration_minutes,createdAt:instant(raw.created_at),description:raw.description||null,raw};
 });
}
