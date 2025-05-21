import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

// Página especial para la cotización de Huggies
const HuggiesPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    // 1. Forzar paso 4 en localStorage
    localStorage.setItem('quote_step_30', '4');
    console.log("HuggiesPage: Establecido paso 4 en localStorage");
    
    // 2. Añadir "force_huggies=true" como indicador para que el contexto lo reconozca
    localStorage.setItem('force_huggies', 'true');
    console.log("HuggiesPage: Establecido flag force_huggies=true");
    
    // 3. Esperar brevemente para asegurar que los cambios en localStorage se guarden
    const timer = setTimeout(() => {
      // 4. Redirigir a la URL que sí funciona correctamente
      console.log("HuggiesPage: Redirigiendo...");
      navigate('/optimized-quote?id=30');
    }, 500);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-primary" 
             xmlns="http://www.w3.org/2000/svg" 
             fill="none" 
             viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <h2 className="text-2xl font-bold mb-2">Cargando cotización de Huggies</h2>
        <p className="text-gray-600">
          Estamos preparando los datos. Serás redirigido automáticamente...
        </p>
      </div>
    </div>
  );
};

export default HuggiesPage;