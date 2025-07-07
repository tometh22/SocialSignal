
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Clock, User, FileText, Users, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { useOptimizedQuote } from '@/context/optimized-quote-context';

interface DraftInfo {
  data: any;
  timestamp: number;
  source: string;
  timeAgo: number;
}

export const DraftRestoreBanner: React.FC = () => {
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { setQuotationData } = useOptimizedQuote();

  useEffect(() => {
    console.log('🔍 BANNER - Iniciando verificación de borradores...');
    
    // Simple: verificar localStorage directamente
    const checkForDrafts = () => {
      try {
        const draft = localStorage.getItem('draft-quotation');
        const backup = localStorage.getItem('draft-quotation-backup');
        const dismissed = localStorage.getItem('draft-banner-dismissed');
        
        console.log('🔍 BANNER - Draft:', !!draft, 'Backup:', !!backup, 'Dismissed:', !!dismissed);
        
        if ((draft || backup) && !dismissed) {
          try {
            let parsedData = null;
            let timestamp = 0;
            let source = '';

            if (draft) {
              const draftParsed = JSON.parse(draft);
              parsedData = draftParsed.quotationData;
              timestamp = draftParsed.timestamp;
              source = 'autoguardado';
            } else if (backup) {
              const backupParsed = JSON.parse(backup);
              parsedData = backupParsed.quotationData;
              timestamp = backupParsed.timestamp;
              source = 'respaldo';
            }

            // Verificar si hay cualquier dato en el borrador
            if (parsedData) {
              const timeAgo = Math.round((Date.now() - timestamp) / (1000 * 60));
              const isRecent = timeAgo < 2880; // 48 horas
              
              console.log('🔍 BANNER - Datos encontrados, timeAgo:', timeAgo, 'isRecent:', isRecent);
              console.log('🔍 BANNER - parsedData:', parsedData);
              
              // Mostrar banner siempre que haya datos, sin importar si están completos
              const info = {
                data: parsedData,
                timestamp: timestamp,
                source: source,
                timeAgo: timeAgo
              };
              
              setDraftInfo(info);
              setIsVisible(true);
              console.log('✅ BANNER - Banner activado con datos:', info);
            } else {
              console.log('ℹ️ BANNER - Borrador sin datos válidos');
            }
          } catch (error) {
            console.error('❌ BANNER - Error parsing:', error);
          }
        } else {
          console.log('ℹ️ BANNER - No hay borradores o fue dismissado');
        }
      } catch (error) {
        console.error('❌ BANNER - Error general:', error);
      }
    };

    // Verificar inmediatamente y cada 5 segundos
    checkForDrafts();
    const interval = setInterval(checkForDrafts, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRestoreDraft = () => {
    if (draftInfo?.data) {
      console.log('📋 Restaurando borrador:', draftInfo.data);
      setQuotationData(draftInfo.data);
      localStorage.removeItem('draft-banner-dismissed');
      setIsVisible(false);
      console.log('✅ Borrador restaurado exitosamente');
    }
  };

  const handleStartFresh = () => {
    localStorage.removeItem('draft-quotation');
    localStorage.removeItem('draft-quotation-backup');
    localStorage.removeItem('pending-draft-restore');
    localStorage.setItem('draft-banner-dismissed', 'true');
    console.log('🆕 Usuario eligió empezar de nuevo');
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('draft-banner-dismissed', 'true');
    setIsVisible(false);
  };

  // TEMPORAL: Función para crear borrador de prueba
  const createTestDraft = () => {
    const testData = {
      client: { name: 'Cliente Test', id: 1 },
      project: { name: 'Proyecto Test' },
      teamMembers: [{ name: 'Test User', role: 'Developer' }],
      timestamp: Date.now()
    };
    localStorage.setItem('draft-quotation', JSON.stringify(testData));
    localStorage.removeItem('draft-banner-dismissed');
    console.log('📝 Borrador de prueba creado');
    window.location.reload(); // Recargar para activar la detección
  };

  const formatTimeAgo = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  };

  // Force show banner for testing
  console.log('🔍 BANNER - Render check - isVisible:', isVisible, 'draftInfo:', !!draftInfo);

  // Verificación directa y forzada de localStorage
  const draftQuotation = localStorage.getItem('draft-quotation');
  const draftBackup = localStorage.getItem('draft-quotation-backup');
  const pendingRestore = localStorage.getItem('pending-draft-restore');
  const dismissed = localStorage.getItem('draft-banner-dismissed');
  
  console.log('🔍 BANNER DEBUG:');
  console.log('  - draft-quotation:', !!draftQuotation);
  console.log('  - draft-quotation-backup:', !!draftBackup);
  console.log('  - pending-draft-restore:', !!pendingRestore);
  console.log('  - banner-dismissed:', !!dismissed);
  console.log('  - isVisible:', isVisible);
  console.log('  - draftInfo:', !!draftInfo);
  
  // Mostrar banner si hay cualquier borrador Y no está descartado
  const shouldShow = (draftQuotation || draftBackup || pendingRestore || isVisible || draftInfo) && !dismissed;
  
  // TEMPORAL: Forzar aparición del banner para testing
  const forceShow = !dismissed;
  console.log('  - shouldShow:', shouldShow, 'forceShow:', forceShow);
  
  if (!shouldShow && !forceShow) {
    return null;
  }

  // Si hay borrador actual pero no draftInfo, crear info temporal
  if (hasActualDraft && !draftInfo) {
    const tempData = { project: { name: 'Datos guardados' }, client: { name: 'Cliente pendiente' } };
    const tempInfo = { data: tempData, timeAgo: 0, source: 'autoguardado' };
    console.log('🔍 BANNER - Usando datos temporales para mostrar banner');
  }
  
  const data = draftInfo?.data || { project: { name: 'Datos guardados' }, client: { name: 'Cliente pendiente' } };
  const timeAgo = draftInfo?.timeAgo || 0;
  const source = draftInfo?.source || 'autoguardado';

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-blue-900">Borrador encontrado</span>
              <div className="flex items-center space-x-1 text-xs text-blue-600">
                <Clock className="h-3 w-3" />
                <span>hace {formatTimeAgo(timeAgo)}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 text-xs text-blue-700 mb-2">
              <div className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span>{data?.client?.name || 'Sin cliente'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <FileText className="h-3 w-3" />
                <span>{data?.project?.name || 'Sin nombre'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3" />
                <span>{data?.teamMembers?.length || 0} miembros</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleRestoreDraft}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3"
              >
                Continuar borrador
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartFresh}
                className="border-blue-300 text-blue-700 hover:bg-blue-100 text-xs h-7 px-3"
              >
                Empezar nuevo
              </Button>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 p-1 h-6 w-6 ml-3 flex-shrink-0"
          title="Cerrar"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
