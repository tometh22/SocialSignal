import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

// Componente de redirección para editar cotizaciones
const QuoteRedirect: React.FC = () => {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Obtener el ID de la cotización desde los parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    const quoteId = params.get('id');
    
    if (quoteId) {
      // Tratamiento especial para la cotización de Huggies (ID 30)
      if (quoteId === '30') {
        console.log('Cotización de Huggies detectada. Aplicando tratamiento especial.');
        
        // Forzar el paso 4 (Revisión y Ajustes)
        localStorage.setItem('quote_step_30', '4');
        
        // Verificar el equipo de la cotización
        fetch('/api/quotation-team/30')
          .then(response => response.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              console.log(`Huggies tiene ${data.length} miembros en su equipo.`);
              localStorage.setItem('huggies_team_members', JSON.stringify(data));
            }
          })
          .catch(err => console.error('Error al verificar equipo Huggies:', err));
        
        // Redireccionar con ID directo (no edit=) para cargar todos los datos completamente
        setTimeout(() => {
          setLocation('/optimized-quote?id=30');
        }, 1500);
      } else {
        // Redireccionar normal para otras cotizaciones
        console.log(`Redireccionando a edición de cotización ID: ${quoteId}`);
        
        // Limpiar cualquier estado guardado previamente para asegurar una carga fresca
        localStorage.removeItem(`quote_step_${quoteId}`);
        
        // Guardar en localStorage un paso avanzado para esta cotización (paso 3)
        localStorage.setItem(`quote_step_${quoteId}`, '3');
        
        // Redireccionar a la página de edición optimizada
        setTimeout(() => {
          setLocation(`/optimized-quote?edit=${quoteId}`);
        }, 1000);
      }
    } else {
      // Si no hay ID, redirigir a la lista de cotizaciones
      console.error("No se proporcionó ID de cotización");
      setLocation('/manage-quotes');
    }
  }, [setLocation]);
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-4">Cargando cotización</h2>
        <p className="text-gray-600 mb-2">
          Estamos preparando tu cotización para edición.
        </p>
        <p className="text-gray-500 text-sm">
          Serás redirigido automáticamente...
        </p>
      </div>
    </div>
  );
};

export default QuoteRedirect;