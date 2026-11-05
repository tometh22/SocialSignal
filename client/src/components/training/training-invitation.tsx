import { Link, useLocation } from "wouter";
import { GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useTrainingCatalog,
  useDismissTrainingInvitation,
} from "@/hooks/use-training";

export function TrainingInvitation() {
  const [location] = useLocation();
  const catalog = useTrainingCatalog();
  const dismiss = useDismissTrainingInvitation();
  if (
    location.startsWith("/training") ||
    !catalog.data ||
    catalog.isError ||
    catalog.data.invitationDismissed
  )
    return null;
  return (
    <aside
      aria-label="Invitación a capacitación"
      className="mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-950 sm:mx-5"
    >
      <GraduationCap className="h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Aprendé a usar Mind a tu ritmo</p>
        <p className="text-xs">
          Lecciones y prácticas elegidas según tu acceso.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/training">Explorar capacitación</Link>
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Descartar invitación a capacitación"
        disabled={dismiss.isPending}
        onClick={() => dismiss.mutate()}
      >
        <X className="h-4 w-4" />
      </Button>
      {dismiss.isError && (
        <p role="alert" className="w-full text-sm">
          No se pudo guardar. Volvé a intentar descartar la invitación.
        </p>
      )}
    </aside>
  );
}
