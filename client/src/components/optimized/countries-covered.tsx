import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface CountriesCoveredProps {
  value: string;
  onChange: (value: string) => void;
}

export function CountriesCovered({ value, onChange }: CountriesCoveredProps) {
  return (
    <div className="space-y-2">
      <Label className="font-medium text-green-800 flex items-center">
        <span className="bg-green-100 p-1 rounded-full mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-700">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </span>
        Países Cubiertos *
      </Label>
      <RadioGroup 
        value={value || '1'} 
        onValueChange={onChange}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        <div className="flex items-center border rounded-md p-3 hover:bg-green-50 transition-colors">
          <RadioGroupItem value="1" id="countries-1" className="mr-2" />
          <Label htmlFor="countries-1" className="cursor-pointer text-sm">
            <div className="font-medium">1 país</div>
            <div className="text-xs text-neutral-500">Un solo país</div>
            <div className="text-xs text-green-600 mt-1">+0%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-green-50 transition-colors">
          <RadioGroupItem value="2-5" id="countries-2-5" className="mr-2" />
          <Label htmlFor="countries-2-5" className="cursor-pointer text-sm">
            <div className="font-medium">2-5 países</div>
            <div className="text-xs text-neutral-500">Regional limitada</div>
            <div className="text-xs text-green-600 mt-1">+5%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-green-50 transition-colors">
          <RadioGroupItem value="6-10" id="countries-6-10" className="mr-2" />
          <Label htmlFor="countries-6-10" className="cursor-pointer text-sm">
            <div className="font-medium">6-10 países</div>
            <div className="text-xs text-neutral-500">Regional amplia</div>
            <div className="text-xs text-green-600 mt-1">+15%</div>
          </Label>
        </div>
        <div className="flex items-center border rounded-md p-3 hover:bg-green-50 transition-colors">
          <RadioGroupItem value="10+" id="countries-10+" className="mr-2" />
          <Label htmlFor="countries-10+" className="cursor-pointer text-sm">
            <div className="font-medium">Más de 10</div>
            <div className="text-xs text-neutral-500">Cobertura global</div>
            <div className="text-xs text-green-600 mt-1">+25%</div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
