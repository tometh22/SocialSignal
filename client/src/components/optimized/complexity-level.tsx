import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ComplexityLevelProps {
  value: string;
  onChange: (value: string) => void;
}

export function ComplexityLevel({ value, onChange }: ComplexityLevelProps) {
  return (
    <div className="mt-8 border rounded-lg p-4 bg-white" id="nivel-complejidad">
      <h3 className="text-lg font-medium mb-4 flex items-center text-blue-700">
        <span className="bg-blue-100 p-1 rounded-full mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </span>
        Nivel de Complejidad del Proyecto
      </h3>
      <RadioGroup 
        value={value || 'medium'} 
        onValueChange={onChange}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="flex items-center border rounded-md p-3 hover:bg-blue-50 transition-colors">
          <RadioGroupItem value="low" id="complejidad-baja" className="mr-2" />
          <Label htmlFor="complejidad-baja" className="cursor-pointer text-sm">
            <div className="font-medium">Baja</div>
            <div className="text-xs text-neutral-500">Proyecto simple con requisitos estándar</div>
            <div className="text-xs text-blue-600 mt-1">+0%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-blue-50 transition-colors">
          <RadioGroupItem value="medium" id="complejidad-media" className="mr-2" />
          <Label htmlFor="complejidad-media" className="cursor-pointer text-sm">
            <div className="font-medium">Media</div>
            <div className="text-xs text-neutral-500">Proyecto complejo con algunos requisitos específicos</div>
            <div className="text-xs text-blue-600 mt-1">+10%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-blue-50 transition-colors">
          <RadioGroupItem value="high" id="complejidad-alta" className="mr-2" />
          <Label htmlFor="complejidad-alta" className="cursor-pointer text-sm">
            <div className="font-medium">Alta</div>
            <div className="text-xs text-neutral-500">Proyecto muy complejo con requisitos específicos</div>
            <div className="text-xs text-blue-600 mt-1">+20%</div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
