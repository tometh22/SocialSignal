import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardList, FolderKanban, CheckSquare, X } from "lucide-react";

const LS_KEY = "review-hub-banner-dismissed";

export default function WhatIsReviewBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(LS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-r from-indigo-50 via-white to-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6">
      <button
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
        onClick={dismiss}
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Column
          icon={<ClipboardList className="h-5 w-5 text-indigo-600" />}
          accent="text-indigo-700"
          title="Review"
          subtitle="Seguimiento semanal con participantes"
          bullets={["Salas por audiencia", "Temas ≠ proyectos"]}
          question="¿Cómo está esto?"
        />
        <Column
          icon={<FolderKanban className="h-5 w-5 text-slate-600" />}
          accent="text-slate-700"
          title="Vista de Proyectos"
          subtitle="Rentabilidad y ciclo de vida"
          bullets={["Todos los proyectos activos", "Siempre un proyecto real"]}
          question="¿Cuánto vale esto?"
        />
        <Column
          icon={<CheckSquare className="h-5 w-5 text-amber-600" />}
          accent="text-amber-700"
          title="Tareas"
          subtitle="Trabajo atómico a ejecutar"
          bullets={["Lista personal o por proyecto", "Siempre una tarea"]}
          question="¿Qué hay que hacer?"
        />
      </div>
    </div>
  );
}

function Column({ icon, accent, title, subtitle, bullets, question }: {
  icon: React.ReactNode; accent: string; title: string; subtitle: string; bullets: string[]; question: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className={`font-semibold text-sm ${accent}`}>{title}</span>
      </div>
      <p className="text-sm text-slate-700 mb-1.5">{subtitle}</p>
      <ul className="text-xs text-slate-500 space-y-0.5">
        {bullets.map(b => <li key={b}>• {b}</li>)}
      </ul>
      <p className="mt-2 text-xs italic text-slate-400">"{question}"</p>
    </div>
  );
}
