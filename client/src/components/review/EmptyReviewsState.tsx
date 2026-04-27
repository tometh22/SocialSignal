import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Props {
  onCreate: () => void;
}

export default function EmptyReviewsState({ onCreate }: Props) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16 px-6">
      <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-indigo-100 flex items-center justify-center text-3xl">📋</div>
      <h2 className="text-2xl font-semibold text-slate-900 mb-3">Creá tu primera sala de status</h2>
      <p className="text-slate-600 leading-relaxed mb-4">
        Una sala de status es un <strong>espacio de seguimiento semanal</strong> con un grupo específico (tu manager, tu equipo, un cliente)
        — o solo para vos.
      </p>
      <p className="text-slate-600 leading-relaxed mb-6">
        Agregás proyectos o temas, cada participante ve el mismo board, y queda el historial de decisiones y updates.
      </p>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left text-sm text-slate-600 mb-6">
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Ejemplos</div>
        <ul className="space-y-1.5">
          <li>• <em>Mi status</em> — tu vista personal, solo para vos</li>
          <li>• <em>Status con COO</em> — proyectos top y decisiones pendientes</li>
          <li>• <em>Sync de Diseño</em> — prioridades del equipo</li>
          <li>• <em>Status cliente Warner</em> — estado de campañas con el cliente</li>
        </ul>
      </div>

      <Button size="lg" onClick={onCreate}>
        <Plus className="h-4 w-4 mr-2" />
        Crear mi primera sala
      </Button>
    </div>
  );
}
