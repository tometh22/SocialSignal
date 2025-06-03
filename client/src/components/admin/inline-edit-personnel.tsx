import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGlobalCacheInvalidation } from "@/hooks/use-global-cache-invalidation";
import { Personnel, Role } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Edit, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { parseDecimal, formatNumericInput } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InlineEditPersonnelProps {
  person: Personnel;
  roles: Role[] | undefined;
  onUpdate?: (updatedPerson: Personnel) => void;
  onDelete?: (personnelId: number) => void;
}

export function InlineEditPersonnel({ person, roles, onUpdate, onDelete }: InlineEditPersonnelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editName, setEditName] = useState(person.name);
  const [editRoleId, setEditRoleId] = useState(person.roleId);
  const [editRate, setEditRate] = useState(person.hourlyRate);
  const [editRateText, setEditRateText] = useState(person.hourlyRate.toString().replace('.', ','));
  const [updatedPerson, setUpdatedPerson] = useState<Personnel>(person);
  const [renderKey, setRenderKey] = useState(0);
  const { toast } = useToast();
  const { updatePersonnelInCache, invalidatePersonnelData } = useGlobalCacheInvalidation();

  // Update when the person prop changes
  useEffect(() => {
    setUpdatedPerson(person);
    if (!isEditing) {
      setEditName(person.name);
      setEditRoleId(person.roleId);
      setEditRate(person.hourlyRate);
      setEditRateText(person.hourlyRate.toString().replace('.', ','));
    }
  }, [person, isEditing]);

  // Get role name by ID
  const getRoleName = (roleId: number) => {
    if (!roles) return "Unknown";
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : "Unknown";
  };

  // Update personnel mutation
  const updatePersonnelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; roleId: number; hourlyRate: number | string } }) => {
      // Asegurar que hourlyRate sea un número antes de enviarlo
      const processedData = {
        ...data,
        hourlyRate: typeof data.hourlyRate === 'string' 
          ? parseFloat(data.hourlyRate.replace(',', '.')) 
          : data.hourlyRate
      };
      
      console.log("Enviando datos procesados:", processedData);
      const response = await fetch(`/api/personnel/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedData),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar personal');
      }
      
      return await response.json();
    },
    onSuccess: (updatedData: Personnel) => {
      console.log("✅ PERSONAL ACTUALIZADO:", updatedData);
      
      // SOLUCIÓN DEFINITIVA: Forzar actualización inmediata con múltiples estrategias
      
      // 1. Actualizar estado local inmediatamente
      setUpdatedPerson({...updatedData});
      setEditName(updatedData.name);
      setEditRoleId(updatedData.roleId);
      setEditRate(updatedData.hourlyRate);
      setEditRateText(updatedData.hourlyRate.toString().replace('.', ','));
      
      // 2. Forzar re-render con key única
      setRenderKey(prev => prev + 1);
      
      // 3. Actualizar caché de React Query inmediatamente
      queryClient.setQueryData(["/api/personnel"], (oldData: Personnel[] | undefined) => {
        if (!oldData) return [updatedData];
        return oldData.map(item => item.id === updatedData.id ? updatedData : item);
      });
      
      // 4. Invalidar y refrescar datos
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      queryClient.refetchQueries({ queryKey: ["/api/personnel"] });
      
      // 5. Notificar al componente padre con datos frescos
      if (onUpdate) {
        onUpdate(updatedData);
      }
      
      // 6. Forzar segunda actualización con delay
      setTimeout(() => {
        setUpdatedPerson({...updatedData});
        setRenderKey(prev => prev + 1);
      }, 50);
      
      // 7. Tercera actualización para casos extremos
      setTimeout(() => {
        setUpdatedPerson({...updatedData});
        queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      }, 200);
      
      toast({
        title: "Guardado",
        description: `${updatedData.name}: $${updatedData.hourlyRate}/hr`,
      });
      setIsEditing(false);
    },
    onError: (error) => {
      console.error("Error detallado al actualizar personal:", error);
      
      // Mostrar mensaje de error con más detalles
      toast({
        title: "Error",
        description: "No se pudo actualizar el miembro del equipo. Verifica la consola para más detalles.",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    // Validate inputs
    if (!editName.trim()) {
      toast({
        title: "Error",
        description: "El nombre no puede estar vacío",
        variant: "destructive",
      });
      return;
    }

    try {
      // Convertir tarifa de texto a número para enviarlo correctamente
      let rateValue = 0;
      
      if (editRateText) {
        // Reemplazar coma por punto para el parsing correcto
        const normalizedValue = editRateText.replace(',', '.');
        rateValue = parseFloat(normalizedValue);
        
        // Validar si es un número válido
        if (isNaN(rateValue) || rateValue <= 0) {
          toast({
            title: "Error",
            description: "La tarifa debe ser un número mayor que 0",
            variant: "destructive",
          });
          return;
        }
        
        // Redondear a 2 decimales
        rateValue = Math.round(rateValue * 100) / 100;
      }
      
      console.log(`Enviando actualización para ID ${person.id}:`, {
        name: editName,
        roleId: editRoleId,
        hourlyRate: rateValue
      });
      
      // Intenta hacer la petición directamente con fetch en lugar de la mutación
      try {
        const response = await fetch(`/api/personnel/${person.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editName,
            roleId: editRoleId,
            hourlyRate: rateValue
          })
        });
        
        if (response.ok) {
          const updatedData = await response.json();
          console.log("Actualización exitosa:", updatedData);
          
          // Usar la respuesta directa del servidor como fuente de la verdad
          console.log("Datos actualizados recibidos:", updatedData);
          
          // Actualizar el estado local con los datos recibidos
          setUpdatedPerson(updatedData);
          
          // Notificar al componente padre usando los datos actualizados
          if (onUpdate) {
            onUpdate(updatedData);
          }
          
          // Actualizar inmediatamente la caché
          queryClient.setQueryData(["/api/personnel"], (oldData: Personnel[] | undefined) => {
            if (!oldData) return [updatedData];
            return oldData.map(item => item.id === updatedData.id ? updatedData : item);
          });
          
          // Un enfoque más directo: actualizar el estado local y forzar una recarga de datos
          try {
            // Actualizamos inmediatamente el estado local
            setUpdatedPerson(updatedData);
            setIsEditing(false);
            
            // Invalidar y forzar recarga de los datos de personal
            await queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
            
            // Forzar un refresco específico de la lista de personal después de una actualización exitosa
            const refreshData = async () => {
              console.log("Refrescando datos de personal desde el servidor...");
              try {
                // Obtener datos actualizados directamente del servidor
                const response = await fetch("/api/personnel");
                if (response.ok) {
                  const freshData = await response.json();
                  
                  // Actualizar la caché con los datos recién obtenidos
                  queryClient.setQueryData(["/api/personnel"], freshData);
                  
                  console.log("Datos refrescados correctamente:", freshData);
                  
                  // Buscar el personal específico que se actualizó
                  const updatedPersonnel = freshData.find((p: Personnel) => p.id === person.id);
                  if (updatedPersonnel) {
                    console.log("Datos actualizados confirmados:", updatedPersonnel);
                    
                    // Actualizar el estado local con los datos más recientes
                    setUpdatedPerson(updatedPersonnel);
                  }
                }
              } catch (refreshError) {
                console.error("Error al refrescar datos:", refreshError);
              }
            };
            
            // Ejecutar el refresco después de un breve momento
            setTimeout(refreshData, 100);
          } catch (error) {
            console.error("Error al actualizar la interfaz:", error);
          }
          
          toast({
            title: "Éxito",
            description: `Personal actualizado. Tarifa actual: $${updatedData.hourlyRate.toFixed(2).replace('.', ',')}/hr`,
          });
          
          setIsEditing(false);
        } else {
          const errorData = await response.json();
          console.error("Error en la respuesta:", errorData);
          throw new Error(errorData.message || "Error en la actualización");
        }
      } catch (fetchError) {
        console.error("Error en la petición fetch:", fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error("Error completo al procesar datos del personal:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la información. Consulta la consola para más detalles.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditName(updatedPerson.name);
    setEditRoleId(updatedPerson.roleId);
    setEditRate(updatedPerson.hourlyRate);
    setIsEditing(false);
  };

  // Delete personnel mutation
  const deletePersonnelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/personnel/${person.id}`);
      return person.id;
    },
    onSuccess: (deletedId) => {
      if (onDelete) {
        onDelete(deletedId);
      }
      
      // Actualizar la caché de React Query eliminando la persona
      queryClient.setQueryData(["/api/personnel"], (oldData: Personnel[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(item => item.id !== deletedId);
      });
      
      toast({
        title: "Éxito",
        description: "Miembro del equipo eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar al miembro del equipo. Puede que esté asignado a una cotización.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deletePersonnelMutation.mutate();
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <TableRow key={`personnel-${person.id}-${renderKey}`} data-personnel-id={person.id}>
        <TableCell className="font-medium">
          {isEditing ? (
            <Input 
              value={editName} 
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-9"
              disabled={updatePersonnelMutation.isPending}
            />
          ) : (
            <div className="flex items-center gap-2">
              {updatePersonnelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <span key={`name-${updatedPerson.id}-${updatedPerson.name}-${renderKey}`}>{updatedPerson.name}</span>
            </div>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Select 
              value={editRoleId.toString()} 
              onValueChange={(value) => setEditRoleId(parseInt(value))}
              disabled={updatePersonnelMutation.isPending}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map(role => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              {updatePersonnelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <span key={`role-${updatedPerson.id}-${updatedPerson.roleId}`}>{getRoleName(updatedPerson.roleId)}</span>
            </div>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Input 
              type="text" 
              inputMode="decimal"
              placeholder="0,00"
              value={editRateText} 
              onChange={(e) => {
                const inputValue = e.target.value;
                setEditRateText(inputValue);
                
                if (inputValue === "") {
                  setEditRate(0);
                  return;
                }
                
                const normalizedValue = inputValue.replace(',', '.');
                const numericValue = parseFloat(normalizedValue);
                if (!isNaN(numericValue)) {
                  setEditRate(numericValue);
                }
              }} 
              className="w-full h-9"
              disabled={updatePersonnelMutation.isPending}
            />
          ) : (
            <div className="flex items-center gap-2">
              {updatePersonnelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              <span key={`rate-${updatedPerson.id}-${updatedPerson.hourlyRate}`} className="font-mono">
                ${updatedPerson.hourlyRate.toFixed(2).replace('.', ',')}/hr
              </span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          {isEditing ? (
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSave}
                disabled={updatePersonnelMutation.isPending}
              >
                {updatePersonnelMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Guardando...
                  </>
                ) : "Guardar"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" /> Eliminar Miembro del Equipo
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que deseas eliminar a <strong>{updatedPerson.name}</strong>?
              <br /><br />
              Esta acción no se puede deshacer. Si este miembro está asignado a alguna cotización, la eliminación fallará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletePersonnelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Eliminando...
                </>
              ) : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}