import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export type FocusItem = { key: string; title: string; healthStatus: string | null; unreadCount: number };
export type FocusGroup<T> = { key: string; label: string; items: T[]; sortable?: boolean };

export function selectStatusFocus<T extends FocusItem>(groups: FocusGroup<T>[], selectedKey: string | null, scope = 'all') {
  const shown = scope === 'all' ? groups : groups.filter(group => group.key === scope);
  const items = shown.flatMap(group => group.items);
  return { groups: shown, item: items.find(item => item.key === selectedKey) ?? items[0] };
}

function IndexRow<T extends FocusItem>({ item, selected, sortable, onSelect, onMove, selection }: {
  item: T; selected: boolean; sortable?: boolean; onSelect: () => void; onMove: (delta: number) => void; selection?: ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id: item.key, disabled: !sortable });
  return <div ref={setNodeRef} id={`row-${item.key}`} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={cn('group flex items-center gap-1 rounded-lg px-1', selected ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-200/40')}>
    {selection}
    {sortable && <button {...attributes} {...listeners} aria-label={`Reordenar ${item.title}`} className="touch-none p-1 text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100"><GripVertical className="h-3 w-3" /></button>}
    <button id={`focus-${item.key}`} onClick={onSelect} aria-current={selected ? 'true' : undefined}
      onKeyDown={event => { const key = event.key.toLowerCase(); if (['arrowdown', 'j', 'arrowup', 'k'].includes(key)) { event.preventDefault(); event.stopPropagation(); onMove(key === 'arrowdown' || key === 'j' ? 1 : -1); } }}
      className="flex flex-1 min-w-0 items-center gap-2.5 px-2 py-3 text-left">
      <span aria-label={item.healthStatus === 'rojo' ? 'Rojo' : item.healthStatus === 'amarillo' ? 'Amarillo' : 'Verde'} className={cn('h-1.5 w-1.5 rounded-full shrink-0', item.healthStatus === 'rojo' ? 'bg-rose-500' : item.healthStatus === 'amarillo' ? 'bg-amber-400' : 'bg-emerald-400')} />
      <span className={cn('flex-1 min-w-0 text-[13px] leading-5 break-words [overflow-wrap:anywhere]', selected ? 'font-semibold text-slate-900' : 'text-slate-600')}>{item.title}</span>
      {item.unreadCount > 0 && <span aria-label="Actividad sin leer" title="Actividad sin leer" className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />}
      {selected && <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
    </button>
  </div>;
}

export default function StatusFocusWorkspace<T extends FocusItem>({ groups, selectedKey, onSelect, renderDetail, search, footer, renderSelection, onReorder }: {
  groups: FocusGroup<T>[]; selectedKey: string | null; onSelect: (key: string) => void;
  renderDetail: (item: T) => ReactNode; search: ReactNode; footer?: ReactNode;
  renderSelection?: (item: T) => ReactNode; onReorder: (active: string, over: string) => void;
}) {
  const [scope, setScope] = useState('all');
  const [mobileDetail, setMobileDetail] = useState(!!selectedKey);
  useEffect(() => { if (selectedKey) setMobileDetail(true); }, [selectedKey]);
  const focus = selectStatusFocus(groups, selectedKey, scope);
  const focusItems = focus.groups.flatMap(group => group.items);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  return <div data-testid="status-list" className="flex flex-1 min-w-0 min-h-0 bg-white">
    <aside aria-label="Temas del status" className={cn('flex flex-col min-h-0 border-r border-slate-200/70 bg-slate-50/80 w-full md:w-[300px] xl:w-[330px] md:shrink-0', mobileDetail && 'max-md:hidden')}>
      <div className="px-5 pt-6 pb-4 space-y-4">
        <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold tracking-tight text-slate-900">Temas</h2><span className="text-xs text-slate-400">{total}</span></div>
        {search}
        <select aria-label="Mostrar temas" value={scope} onChange={event => { setScope(event.target.value); setMobileDetail(false); }} className="w-full bg-transparent text-xs text-slate-500 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 rounded">
          <option value="all">Todos los temas · {total}</option>
          {groups.map(group => <option key={group.key} value={group.key}>{group.label} · {group.items.length}</option>)}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-5">
        <DndContext collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) onReorder(String(active.id), String(over.id)); }}>
          {focus.groups.filter(group => group.items.length > 0).map(group => <section key={group.key} aria-label={group.label} className="mb-5">
            <h3 className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.12em] font-medium text-slate-400">{group.label} <span className="ml-1">{group.items.length}</span></h3>
            <SortableContext items={group.items.map(item => item.key)} strategy={verticalListSortingStrategy}>
              {group.items.map(item => <IndexRow key={item.key} item={item} sortable={group.sortable} selected={focus.item?.key === item.key}
                selection={renderSelection?.(item)} onSelect={() => { onSelect(item.key); setMobileDetail(true); }}
                onMove={delta => {
                  const next = focusItems[focusItems.findIndex(candidate => candidate.key === item.key) + delta];
                  if (next) { onSelect(next.key); document.getElementById(`focus-${next.key}`)?.focus(); }
                }} />)}
            </SortableContext>
          </section>)}
        </DndContext>
        {!focus.item && <p className="px-3 py-6 text-sm text-slate-400">No hay temas para mostrar.</p>}
      </div>
      {footer && <div className="border-t border-slate-200/70 px-5 py-4">{footer}</div>}
    </aside>
    <main aria-label="Tema seleccionado" className={cn('flex-1 min-w-0 min-h-0 flex flex-col', !mobileDetail && 'max-md:hidden')}>
      <button onClick={() => setMobileDetail(false)} className="md:hidden flex items-center gap-1 px-5 py-3 text-xs text-slate-500 border-b border-slate-100"><ChevronLeft className="h-3 w-3" /> Todos los temas</button>
      {focus.item ? renderDetail(focus.item) : <div className="m-auto p-8 text-sm text-slate-400">Buscá otro tema o agregá uno nuevo.</div>}
    </main>
  </div>;
}
