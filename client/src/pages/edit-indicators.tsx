import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import EditIndicatorsForm from '@/components/modo/edit-indicators-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const EditIndicatorsPage: React.FC = () => {
  const { deliverableId } = useParams();
  const parsedId = deliverableId ? parseInt(deliverableId) : null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Obtener los datos del entregable
  const { data: deliverable, isLoading, error } = useQuery({
    queryKey: ['/api/deliverables', parsedId],
    queryFn: async () => {
      if (!parsedId) return null;
      const response = await fetch(`/api/deliverables/${parsedId}`);
      if (!response.ok) {
        throw new Error('No se pudo cargar el entregable');
      }
      return response.json();
    },
    enabled: !!parsedId
  });

  const handleSuccess = () => {
    toast({
      title: 'Éxito',
      description: 'Los indicadores se han actualizado correctamente'
    });
    
    // Redirigir a la vista de proyecto
    if (deliverable?.project_id) {
      setLocation(`/project-analytics/${deliverable.project_id}`);
    } else {
      setLocation('/active-projects');
    }
  };

  if (isLoading) {
    return (
      <div className="container py-10">
        <Card>
          <CardContent className="py-10 text-center">
            Cargando entregable...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !deliverable) {
    return (
      <div className="container py-10">
        <Card>
          <CardContent className="py-10 text-center">
            No se pudo cargar el entregable. Intente nuevamente.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setLocation(`/project-analytics/${deliverable.project_id}`)}
          className="mr-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al proyecto
        </Button>
        <h1 className="text-2xl font-bold">Editar Indicadores: {deliverable.title || deliverable.name}</h1>
      </div>

      <EditIndicatorsForm 
        deliverableId={parsedId || 0}
        projectId={deliverable.project_id}
        initialData={deliverable}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default EditIndicatorsPage;