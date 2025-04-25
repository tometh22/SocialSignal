import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface AnalysisTypeProps {
  value: string;
  onChange: (value: string) => void;
}

export function AnalysisType({ value, onChange }: AnalysisTypeProps) {
  return (
    <div className="space-y-2">
      <Label className="font-medium text-blue-800 flex items-center">
        <span className="bg-blue-100 p-1 rounded-full mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
            <path d="m21 8-2-2m-9 6 3-3 3 3"></path>
            <path d="M7 21h10"></path>
            <path d="M15 21V8"></path>
            <path d="M7 12h2"></path>
            <path d="M7 16h2"></path>
          </svg>
        </span>
        Tipo de Análisis *
      </Label>
      <RadioGroup 
        value={value || 'standard'} 
        onValueChange={onChange}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2"
      >
        <div className="flex items-center border rounded-md p-3 hover:bg-blue-50 transition-colors">
          <RadioGroupItem value="basic" id="analysis-basic" className="mr-2" />
          <Label htmlFor="analysis-basic" className="cursor-pointer text-sm">
            <div className="font-medium">Básico</div>
            <div className="text-xs text-neutral-500">Sin profundidad</div>
            <div className="text-xs text-blue-600 mt-1">+0%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-blue-50 transition-colors">
          <RadioGroupItem value="standard" id="analysis-standard" className="mr-2" />
          <Label htmlFor="analysis-standard" className="cursor-pointer text-sm">
            <div className="font-medium">Estándar</div>
            <div className="text-xs text-neutral-500">Métricas completas</div>
            <div className="text-xs text-blue-600 mt-1">+10%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-blue-50 transition-colors">
          <RadioGroupItem value="advanced" id="analysis-advanced" className="mr-2" />
          <Label htmlFor="analysis-advanced" className="cursor-pointer text-sm">
            <div className="font-medium">Avanzado</div>
            <div className="text-xs text-neutral-500">Metodologías especiales</div>
            <div className="text-xs text-blue-600 mt-1">+15%</div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
