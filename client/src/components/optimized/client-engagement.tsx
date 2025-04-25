import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ClientEngagementProps {
  value: string;
  onChange: (value: string) => void;
}

export function ClientEngagement({ value, onChange }: ClientEngagementProps) {
  return (
    <div className="space-y-2">
      <Label className="font-medium text-purple-800 flex items-center">
        <span className="bg-purple-100 p-1 rounded-full mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700">
            <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path>
            <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>
          </svg>
        </span>
        Nivel de Interacción con el Cliente *
      </Label>
      <RadioGroup 
        value={value || 'medium'} 
        onValueChange={onChange}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2"
      >
        <div className="flex items-center border rounded-md p-3 hover:bg-purple-50 transition-colors">
          <RadioGroupItem value="low" id="engagement-low" className="mr-2" />
          <Label htmlFor="engagement-low" className="cursor-pointer text-sm">
            <div className="font-medium">Bajo</div>
            <div className="text-xs text-neutral-500">Informe final</div>
            <div className="text-xs text-purple-600 mt-1">+0%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-purple-50 transition-colors">
          <RadioGroupItem value="medium" id="engagement-medium" className="mr-2" />
          <Label htmlFor="engagement-medium" className="cursor-pointer text-sm">
            <div className="font-medium">Medio</div>
            <div className="text-xs text-neutral-500">Reunión inicial y final</div>
            <div className="text-xs text-purple-600 mt-1">+5%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-purple-50 transition-colors">
          <RadioGroupItem value="high" id="engagement-high" className="mr-2" />
          <Label htmlFor="engagement-high" className="cursor-pointer text-sm">
            <div className="font-medium">Alto</div>
            <div className="text-xs text-neutral-500">Reuniones semanales</div>
            <div className="text-xs text-purple-600 mt-1">+15%</div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
