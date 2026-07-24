import { Link } from "wouter";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EstimatedRates() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Valor hora unificado</CardTitle>
          <CardDescription>
            Las tarifas actuales, históricas y usadas por Cotizaciones se sincronizan desde el Máster en Configuración → Personal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Esta pantalla ya no mantiene una segunda grilla editable. Cierre mensual y Cotizaciones consumen el mismo historial de Personal.
          </div>
          <Link href="/admin">
            <Button>
              Ir a Configuración → Personal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
