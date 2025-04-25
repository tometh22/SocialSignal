import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface MentionsVolumeProps {
  value: string;
  onChange: (value: string) => void;
}

export function MentionsVolume({ value, onChange }: MentionsVolumeProps) {
  return (
    <div className="space-y-2">
      <Label className="font-medium text-amber-800 flex items-center">
        <span className="bg-amber-100 p-1 rounded-full mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
            <path d="M7 8a5 5 0 1 1 10 0c0 3.44-3.8 6-5 8"></path>
            <line x1="12" y1="20" x2="12" y2="20"></line>
          </svg>
        </span>
        Volumen de Menciones *
      </Label>
      <RadioGroup 
        value={value || 'medium'} 
        onValueChange={onChange}
        className="grid grid-cols-1 sm:grid-cols-4 gap-2"
      >
        <div className="flex items-center border rounded-md p-3 hover:bg-amber-50 transition-colors">
          <RadioGroupItem value="small" id="volume-small" className="mr-2" />
          <Label htmlFor="volume-small" className="cursor-pointer text-sm">
            <div className="font-medium">Pequeño</div>
            <div className="text-xs text-neutral-500">Menos de 1,000</div>
            <div className="text-xs text-amber-600 mt-1">+0%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-amber-50 transition-colors">
          <RadioGroupItem value="medium" id="volume-medium" className="mr-2" />
          <Label htmlFor="volume-medium" className="cursor-pointer text-sm">
            <div className="font-medium">Medio</div>
            <div className="text-xs text-neutral-500">1,000-10,000</div>
            <div className="text-xs text-amber-600 mt-1">+10%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-amber-50 transition-colors">
          <RadioGroupItem value="large" id="volume-large" className="mr-2" />
          <Label htmlFor="volume-large" className="cursor-pointer text-sm">
            <div className="font-medium">Grande</div>
            <div className="text-xs text-neutral-500">10,000-50,000</div>
            <div className="text-xs text-amber-600 mt-1">+20%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-amber-50 transition-colors">
          <RadioGroupItem value="xlarge" id="volume-xlarge" className="mr-2" />
          <Label htmlFor="volume-xlarge" className="cursor-pointer text-sm">
            <div className="font-medium">Extra grande</div>
            <div className="text-xs text-neutral-500">Más de 50,000</div>
            <div className="text-xs text-amber-600 mt-1">+30%</div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
