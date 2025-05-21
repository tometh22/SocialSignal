import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Spinner } from '@/components/ui/spinner';

// Componente especializado solo para la cotización de Huggies
const HuggiesQuoteRedirect: React.FC = () => {
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("Iniciando redirección especial para Huggies");
    
    // Primero forzar el paso 4 en localStorage
    localStorage.setItem('quote_step_30', '4');
    
    // Redireccionar después de un breve retraso para asegurar que el storage se actualice
    const redirectTimer = setTimeout(() => {
      console.log("Redireccionando a cotización de Huggies con paso 4 forzado");
      setLocation('/optimized-quote?id=30');
    }, 500);
    
    return () => clearTimeout(redirectTimer);
  }, [setLocation]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Cargando cotización de Huggies</h2>
        <p className="text-muted-foreground">Preparando datos del proyecto, por favor espere...</p>
      </div>
    </div>
  );
};

export default HuggiesQuoteRedirect;