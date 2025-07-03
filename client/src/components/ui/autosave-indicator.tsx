import React, { useState, useEffect } from 'react';
import { Check, Clock, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface AutosaveIndicatorProps {
  lastSaveTime?: number;
  isOnline?: boolean;
  hasUnsavedChanges?: boolean;
}

export const AutosaveIndicator: React.FC<AutosaveIndicatorProps> = ({
  lastSaveTime,
  isOnline = true,
  hasUnsavedChanges = false
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'pending' | 'error'>('saved');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (lastSaveTime && Date.now() - lastSaveTime < 2000) {
      setSaveStatus('saved');
    } else if (hasUnsavedChanges) {
      setSaveStatus('pending');
    }
  }, [lastSaveTime, hasUnsavedChanges]);

  const getTimeSinceLastSave = () => {
    if (!lastSaveTime) return '';
    const seconds = Math.floor((currentTime - lastSaveTime) / 1000);
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `hace ${hours}h`;
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-3 w-3 text-red-500" />;
    
    switch (saveStatus) {
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
    
    switch (saveStatus) {
      case 'saved':
        return `Guardado ${getTimeSinceLastSave()}`;
      case 'saving':
        return 'Guardando...';
      case 'pending':
        return 'Cambios pendientes';
      case 'error':
        return 'Error al guardar';
      default:
        return 'Autoguardado activo';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600 bg-red-50 border-red-200';
    
    switch (saveStatus) {
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
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor()}`}>
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  );
};

export default AutosaveIndicator;