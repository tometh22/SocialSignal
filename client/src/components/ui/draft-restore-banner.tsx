import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">
                  📋 Borrador encontrado
                </h3>
                <div className="text-sm text-amber-800 space-y-2">
                  <div className="flex items-center space-x-4 flex-wrap">
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{data.client?.name || 'Sin cliente'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">{data.project?.name || 'Sin nombre'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">{data.teamMembers?.length || 0} miembros</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>Guardado hace {formatTimeAgo(timeAgo)}</span>
                  </p>
                </div>
                <div className="flex items-center space-x-3 mt-3">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRestoreDraft}
                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  >
                    ✅ Continuar con borrador
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartFresh}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    🆕 Empezar nueva cotización
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 p-1 ml-2"
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};