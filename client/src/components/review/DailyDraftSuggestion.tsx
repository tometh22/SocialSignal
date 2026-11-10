import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { authFetch } from '@/lib/queryClient';

export default function DailyDraftSuggestion({ kind, targetId, draft, onUse }: {
  kind: 'project' | 'custom';
  targetId: number;
  draft: string;
  onUse: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');
  const [sourceDraft, setSourceDraft] = useState('');

  const suggest = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setSuggestion('');
    setSourceDraft(draft);
    try {
      const res = await authFetch('/api/status-semanal/ai-draft', {
        method: 'POST', body: JSON.stringify({ kind, targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'No se pudo generar la sugerencia');
      if (typeof data.suggestion !== 'string' || !data.suggestion.trim()) throw new Error('La IA no devolvió una sugerencia');
      setSuggestion(data.suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la sugerencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 space-y-2" onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}>
      <button type="button" disabled={loading} onClick={() => void suggest()}
        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? 'Leyendo el hilo…' : 'Sugerir mensaje con IA'}
      </button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {suggestion && <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3" aria-live="polite">
        <p className="text-xs font-medium text-indigo-700 mb-1">Borrador sugerido · revisalo antes de guardar</p>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{suggestion}</p>
        <div className="mt-2 flex gap-3">
          <button type="button" disabled={draft !== sourceDraft} className="text-xs font-medium text-indigo-700 disabled:opacity-50"
            onClick={() => { onUse(suggestion); setSuggestion(''); }}>Usar borrador</button>
          <button type="button" className="text-xs text-slate-500" onClick={() => setSuggestion('')}>Descartar</button>
        </div>
        {draft !== sourceDraft && <p className="mt-2 text-xs text-slate-500">Editaste el texto. Pedí otra sugerencia para usar un nuevo borrador.</p>}
      </div>}
    </div>
  );
}
