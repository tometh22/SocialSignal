import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/queryClient';

// Componente de redirección para editar cotizaciones
const QuoteRedirect: React.FC = () => {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quoteId = params.get('id');

    if (quoteId) {
      // Limpiar estado previo y preparar para edición
      localStorage.removeItem(`quote_step_${quoteId}`);
      localStorage.setItem(`quote_step_${quoteId}`, '3');

      // Precargar equipo de la cotización
      authFetch(`/api/quotation-team/${quoteId}`)
        .then(response => response.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            localStorage.setItem(`quote_team_${quoteId}`, JSON.stringify(data));
          }
        })
        .catch(err => console.error('Error al verificar equipo:', err));

      // Redireccionar a la página de edición optimizada
      setTimeout(() => {
        setLocation(`/optimized-quote?edit=${quoteId}`);
      }, 1000);
    } else {
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