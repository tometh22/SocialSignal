import React, { useState, useEffect } from 'react';
import { Check, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import type { AutosaveStatus } from '@/context/optimized-quote-context';

interface AutosaveIndicatorProps {
  lastSaveTime?: number;
  isOnline?: boolean;
  status?: AutosaveStatus;
}

export const AutosaveIndicator: React.FC<AutosaveIndicatorProps> = ({
  lastSaveTime,
  isOnline = true,
  status = 'idle',
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getTimeSinceLastSave = () => {
    if (!lastSaveTime) return '';
    // El timer de currentTime corre en su propio setInterval de 1s, así que
    // puede quedar un tick atrás del momento exacto en que se guardó --
    // sin este piso se veía "hace -1s" en el instante justo después de
    // guardar.
    const seconds = Math.max(0, Math.floor((currentTime - lastSaveTime) / 1000));
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `hace ${hours}h`;
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-3 w-3 text-red-500" />;
    
    switch (status) {
      case 'saved':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'saving':
        return <Clock className="h-3 w-3 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'Sin conexión';

    // El autoguardado sólo escribe en localStorage (ver el efecto en
    // optimized-quote-context.tsx): no hay ningún round-trip al servidor
    // acá. "Guardado" a secas sugería lo contrario -- con el mismo ícono y
    // color verde que un guardado real -- y llevó a pensar que cotizaciones
    // enteras "desaparecían" cuando en realidad nunca habían llegado al
    // servidor porque nadie clickeó "Guardar borrador". El texto ahora dice
    // explícitamente "en este navegador".
    switch (status) {
      case 'saved':
        return `Borrador local guardado ${getTimeSinceLastSave()}`;
      case 'saving':
        return 'Guardando borrador local...';
      case 'pending':
        return 'Cambios sin guardar en este navegador';
      case 'error':
        return 'Error al guardar el borrador local';
      case 'idle':
        return 'Autoguardado local listo';
      default:
        return 'Autoguardado local activo';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600 bg-red-50 border-red-200';
    
    switch (status) {
      case 'saved':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'saving':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor()}`}
    >
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  );
};

export default AutosaveIndicator;
