import React from "react";
import { Link } from "wouter";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";

interface AlwaysOnBudgetAlertProps {
  clientId: number;
  clientName: string;
  globalBudget: number;
  parentProjectId?: number;
}

export function AlwaysOnBudgetAlert({ clientId, clientName, globalBudget, parentProjectId }: AlwaysOnBudgetAlertProps) {
  return (
    <Alert className="bg-blue-50 border-blue-200 mb-4">
      <AlertTitle className="text-blue-700 flex items-center text-sm font-medium">
        Proyecto "Always On" - Presupuesto Compartido
      </AlertTitle>
      <AlertDescription className="text-blue-600 text-xs">
        <p className="mb-1">
          Este proyecto forma parte de {clientName}, que opera con un presupuesto consolidado 
          de ${globalBudget.toLocaleString()} mensuales compartido entre varios subproyectos.
        </p>
        <div className="mt-2">
          <Link href={`/client-summary/${clientId}`} className="text-blue-700 inline-flex items-center text-xs hover:underline">
            Ver resumen completo del cliente
            <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  );
}