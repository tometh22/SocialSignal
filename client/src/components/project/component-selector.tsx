import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ProjectComponent {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
}

interface ComponentSelectorProps {
  projectId: number;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

const ComponentSelector: React.FC<ComponentSelectorProps> = ({
  projectId,
  value,
  onChange,
  disabled = false,
}) => {
  const [selectedValue, setSelectedValue] = useState<string>(value ? value.toString() : "0");

  // Consulta para obtener los componentes del proyecto
  const {
    data: components,
    isLoading,
    isError,
  } = useQuery<ProjectComponent[]>({
    queryKey: ['/api/project-components', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/project-components/${projectId}`);
      const data = await response.json();
      return data;
    },
    enabled: !!projectId,
  });

  // Actualizar el valor seleccionado cuando cambie externamente
  useEffect(() => {
    setSelectedValue(value ? value.toString() : "0");
  }, [value]);

  // Si no hay componentes o hay un error, no mostrar el selector
  if ((components && components.length === 0) || isError) {
    return null;
  }

  const handleChange = (newValue: string) => {
    setSelectedValue(newValue);
    onChange(newValue === "0" || newValue === "" ? null : parseInt(newValue));
  };

  return (
    <div>
      <Select
        value={selectedValue}
        onValueChange={handleChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecciona un componente (opcional)" />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Cargando...</span>
            </div>
          ) : (
            <SelectGroup>
              <SelectItem value="0">Sin componente específico</SelectItem>
              {components?.map((component) => (
                <SelectItem key={component.id} value={component.id.toString()}>
                  <div className="flex items-center gap-2">
                    {component.name}
                    {component.isDefault && (
                      <Badge variant="outline" className="text-xs py-0 h-4">
                        Predeterminado
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ComponentSelector;