import { parse } from 'csv-parse/sync';

export function civilDate(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) !== value) throw new Error(`Fecha civil inválida: ${value}`);
  return `${value}T12:00:00Z`;
}

export function actualMinutes(value) {
  if (!value) return null;
  const match = /^(\d+):(\d{2})$/.exec(value);
  if (!match || Number(match[2]) > 59) throw new Error(`Duración inválida: ${value}`);
  return Number(match[1])*60+Number(match[2]);
}

/** CSV exports contain parent names, not IDs. Never guess an ambiguous parent. */
export function parseAsanaTasks(text) {
  const rows=parse(text,{columns:true,bom:true,skip_empty_lines:true,relax_column_count:false});
  if (!text.replace(/^\uFEFF/,'').startsWith('Task ID,')) throw new Error('No es una exportación oficial de tareas Asana');
  const seen=new Map();
  for (const [position,row] of rows.entries()) {
    // Asana permits genuinely unnamed subtasks. Preserve an empty source title.
    if (!/^\d+$/.test(row['Task ID'] || '') || typeof row.Name !== 'string') throw new Error(`Tarea inválida en fila ${position+2}`);
    if (seen.has(row['Task ID'])) { seen.get(row['Task ID']).sourceDuplicates.push(row); continue; }
    seen.set(row['Task ID'],{ gid:row['Task ID'],title:row.Name,description:row.Notes || null,section:row['Section/Column'] || null,assigneeName:row.Assignee || null,assigneeEmail:row['Assignee Email'] || null,startDate:civilDate(row['Start Date']),dueDate:civilDate(row['Due Date']),completedAt:civilDate(row['Completed At']),createdAt:civilDate(row['Created At']),status:row['Completed At']?'done':'todo',actualMinutes:actualMinutes(row['Actual time']),parentName:row['Parent task'] || null,parentGid:null,parentResolution:'none',position,raw:row,sourceDuplicates:[]});
  }
  const tasks=[...seen.values()];
  let ancestors=[];
  for (const task of tasks) {
    if (!task.parentName) {ancestors=[task];task.section ||= 'General';continue;}
    const ancestorIndex=ancestors.findLastIndex(t=>t.title===task.parentName && t.gid!==task.gid);
    const candidates=tasks.filter(t=>t.title===task.parentName && t.gid!==task.gid);
    const parent=ancestorIndex>=0 ? ancestors[ancestorIndex] : candidates.length===1 ? candidates[0] : null;
    task.parentResolution=parent?'resolved':candidates.length?'ambiguous':'missing';
    task.parentGid=parent?.gid || null;
    task.section ||= parent?.section || ancestors[0]?.section || 'General';
    ancestors=ancestorIndex>=0 ? [...ancestors.slice(0,ancestorIndex+1),task] : parent?[parent,task]:[task];
  }
  const visiting=new Set(),visited=new Set();
  function visit(task){
    if(visiting.has(task.gid)) throw new Error('La exportación contiene un ciclo entre tareas madre');
    if(visited.has(task.gid)) return;
    visiting.add(task.gid);if(task.parentGid)visit(seen.get(task.parentGid));visiting.delete(task.gid);visited.add(task.gid);
  }
  tasks.forEach(visit);
  return { tasks,rows:rows.length,duplicateRows:rows.length-tasks.length,unresolvedParents:tasks.filter(t=>['ambiguous','missing'].includes(t.parentResolution)).map(t=>({gid:t.gid,title:t.title,parentName:t.parentName,reason:t.parentResolution})) };
}
