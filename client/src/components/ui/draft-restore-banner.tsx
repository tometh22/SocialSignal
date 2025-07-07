
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Clock, User, FileText, Users, AlertCircle } from 'lucide-react';
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
    console.log('🔍 DRAFT RESTORE BANNER - Component mounted');
    
    try {
      // Check for pending draft restore
      const pendingDraft = localStorage.getItem('pending-draft-restore');
      console.log('🔍 DRAFT RESTORE BANNER - Pending draft:', pendingDraft);

      if (pendingDraft) {
        const parsed = JSON.parse(pendingDraft);
        console.log('🔍 DRAFT RESTORE BANNER - Parsed pending draft:', parsed);
        
        // Validar que el draft tenga datos válidos
        if (parsed.data && typeof parsed.timeAgo === 'number') {
          setDraftInfo(parsed);
          setIsVisible(true);
          console.log('✅ DRAFT RESTORE BANNER - Banner should be visible now');
        } else {
          console.warn('⚠️ DRAFT RESTORE BANNER - Invalid draft data structure');
          localStorage.removeItem('pending-draft-restore');
        }
      } else {
        console.log('ℹ️ DRAFT RESTORE BANNER - No pending draft found');
      }
    } catch (error) {
      console.error('❌ DRAFT RESTORE BANNER - Error in useEffect:', error);
      // Limpiar datos corruptos
      localStorage.removeItem('pending-draft-restore');
    }
  }, []);

  const handleRestoreDraft = () => {
    if (draftInfo?.data) {
      setQuotationData(draftInfo.data);
      console.log('📋 Borrador restaurado desde banner');
      handleDismiss();
    }
  };

  const handleStartFresh = () => {
    // Clear all draft data
    localStorage.removeItem('draft-quotation');
    localStorage.removeItem('draft-quotation-backup');
    localStorage.removeItem('pending-draft-restore');
    console.log('🆕 Usuario eligió empezar de nuevo');
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.removeItem('pending-draft-restore');
  };

  const formatTimeAgo = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  };

  if (!isVisible || !draftInfo) {
    return null;
  }

  const { data, timeAgo } = draftInfo;

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-sm font-semibold text-amber-900">📋 Borrador encontrado</span>
              <div className="flex items-center space-x-1 text-xs text-amber-600">
                <Clock className="h-3 w-3" />
                <span>hace {formatTimeAgo(timeAgo)}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 text-xs text-amber-700 mb-3">
              <div className="flex items-center space-x-1">
                <User className="h-3 w-3" />
                <span>{data.client?.name || 'Sin cliente'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <FileText className="h-3 w-3" />
                <span>{data.project?.name || 'Sin nombre'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3" />
                <span>{data.teamMembers?.length || 0} miembros</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleRestoreDraft}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
              >
                Continuar borrador
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartFresh}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 text-xs h-8"
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
          className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 p-1 h-6 w-6 ml-3 flex-shrink-0"
          title="Cerrar"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
