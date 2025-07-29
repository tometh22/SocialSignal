import React from 'react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';
import { Check } from 'lucide-react';

const OptimizedStepperNav: React.FC = () => {
  const { currentStep, goToStep, quotationData } = useOptimizedQuote();
  
  const steps = [
    { 
      num: 1, 
      title: "Información básica",
      isCompleted: !!quotationData.client && !!quotationData.project.name
    },
    { 
      num: 2, 
      title: "Plantilla del proyecto",
      isCompleted: !!quotationData.template
    },
    { 
      num: 3, 
      title: "Configuración del Equipo",
      count: quotationData.teamMembers.length,
      isCompleted: quotationData.teamMembers.length > 0
    },
    { 
      num: 4, 
      title: "Revisión final",
      isCompleted: false
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-6">Editar Cotización</h2>
      <p className="text-gray-600 mb-8">Crea y gestiona cotizaciones de manera optimizada</p>
      
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-200" />
        <div 
          className="absolute top-8 left-0 h-0.5 bg-blue-600 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
        
        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step) => (
            <div 
              key={step.num}
              className="flex flex-col items-center cursor-pointer"
              onClick={() => goToStep(step.num)}
            >
              <div className={`
                w-16 h-16 rounded-full flex items-center justify-center text-lg font-semibold
                transition-all duration-200 relative
                ${currentStep === step.num 
                  ? 'bg-blue-600 text-white shadow-lg scale-110' 
                  : step.num < currentStep 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                }
              `}>
                {step.num < currentStep ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <>
                    {step.count !== undefined ? step.count : step.num}
                    {step.count !== undefined && step.count > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                        ✓
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="mt-3 text-center">
                <p className={`text-sm font-medium ${
                  currentStep === step.num ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {step.title}
                </p>
                {step.count !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">
                    {step.count} {step.count === 1 ? 'miembro' : 'miembros'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mt-8">
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-600">Total horas</p>
          <p className="text-lg font-bold text-gray-900">
            {quotationData.teamMembers.reduce((sum, member) => sum + (member.hours || 0), 0)}h
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-600">Costo total</p>
          <p className="text-lg font-bold text-gray-900">
            ${quotationData.teamMembers.reduce((sum, member) => sum + (member.cost || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-600">Promedio/hora</p>
          <p className="text-lg font-bold text-gray-900">
            ${quotationData.teamMembers.length > 0 
              ? Math.round(quotationData.teamMembers.reduce((sum, member) => sum + (member.rate || 0), 0) / quotationData.teamMembers.length)
              : 0}
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <p className="text-xs text-gray-600">Equipo</p>
          <p className="text-lg font-bold text-gray-900">
            {quotationData.teamMembers.length}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          + Agregar por Rol
        </button>
        <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          👤 Agregar Personas
        </button>
      </div>
    </div>
  );
};

export default OptimizedStepperNav;