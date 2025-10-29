import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, TrendingUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OneShotBannerProps {
  projectName: string;
  hasRevenueInPeriod: boolean;
  periodLabel: string;
  periodWithRevenue?: string | null;
}

export function OneShotBanner({ 
  projectName, 
  hasRevenueInPeriod, 
  periodLabel,
  periodWithRevenue 
}: OneShotBannerProps) {
  if (hasRevenueInPeriod) {
    return (
      <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 mb-4">
        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-900 dark:text-green-100 font-semibold">
          Proyecto One-Shot
        </AlertTitle>
        <AlertDescription className="text-green-800 dark:text-green-200">
          Este proyecto tiene facturación única en <strong>{periodLabel}</strong>. 
          Los costos acumulados durante la ejecución se comparan contra el ingreso total.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 mb-4">
      <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold flex items-center gap-2">
        <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300">
          ONE-SHOT
        </Badge>
        Periodo sin facturación
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200 space-y-2">
        <p>
          <strong className="font-semibold">{projectName}</strong> es un proyecto one-shot (pago único).
        </p>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          <span>
            Facturación registrada en: {periodWithRevenue ? (
              <strong className="font-semibold">{formatPeriodKey(periodWithRevenue)}</strong>
            ) : (
              <span className="italic">No disponible</span>
            )}
          </span>
        </div>
        <p className="text-sm mt-2">
          Los costos de <strong>{periodLabel}</strong> son parte de la ejecución del proyecto. 
          Para evaluar la rentabilidad correcta, consulta las <strong>Métricas del Proyecto Completo</strong> más abajo.
        </p>
      </AlertDescription>
    </Alert>
  );
}

function formatPeriodKey(periodKey: string): string {
  const [year, month] = periodKey.split('-');
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}
