import type { RefObject } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useAutoResize } from '@/hooks/use-auto-resize-textarea';
import { cn } from '@/lib/utils';

export default function DailyStatusEditor({ itemKey, value, onChange, textareaRef, listening, onToggleListening }: {
  itemKey: string;
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  listening: boolean;
  onToggleListening: () => void;
}) {
  useAutoResize(textareaRef, value, true, 480, itemKey);

  return (
    <>
      <label className="mb-2 block text-sm font-medium" htmlFor="daily-current-action">Estado actual</label>
      <div className="relative">
        <textarea key={itemKey} id="daily-current-action" ref={textareaRef} rows={8} value={value} onChange={e => onChange(e.target.value)}
          aria-label="Estado actual" aria-describedby="daily-editor-help" placeholder="¿Qué está pasando?"
          className="block w-full min-h-[200px] border border-slate-200 rounded-xl p-3 pr-12 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y overflow-auto" />
        <button onClick={onToggleListening} title={listening ? 'Detener dictado' : 'Dictar'}
          className={cn("absolute right-2 top-2 p-1.5 rounded-full transition-colors", listening ? "bg-red-100 text-red-600 animate-pulse" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50")}>
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>
      <p id="daily-editor-help" className="mt-1.5 text-xs text-slate-500">Arrastrá la esquina inferior derecha para ajustar el alto. Enter guarda y sigue · Shift+Enter agrega una línea.</p>
    </>
  );
}
