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
    const checkForDrafts = () => {
      try {
        const draft = localStorage.getItem('draft-quotation');
        const dismissed = localStorage.getItem('draft-banner-dismissed');

        console.log('🔍 BANNER - Verificando borradores:', { draft: !!draft, dismissed: !!dismissed });

        if (draft && !dismissed) {
          const draftParsed = JSON.parse(draft);
          const quotationData = draftParsed.quotationData || draftParsed;
          const timestamp = draftParsed.timestamp || Date.now();

          // Verificar si hay datos reales en el borrador
          const hasRealData = quotationData && (
            quotationData.client?.name ||
            quotationData.project?.name ||
            quotationData.teamMembers?.length > 0
          );

          if (hasRealData) {
            const timeAgo = Math.round((Date.now() - timestamp) / (1000 * 60));

            setDraftInfo({
              data: quotationData,
              timestamp,
              source: 'autoguardado',
              timeAgo
            });
            setIsVisible(true);

            console.log('✅ BANNER - Borrador encontrado y banner activado');
          } else {
            console.log('ℹ️ BANNER - Borrador vacío, no se muestra banner');
          }
        }
      } catch (error) {
        console.error('❌ BANNER - Error:', error);
      }
    };

    checkForDrafts();
  }, []);

  const handleRestoreDraft = () => {
    if (draftInfo?.data) {
      console.log('📋 Restaurando borrador:', draftInfo.data);
      setQuotationData(draftInfo.data);
      setIsVisible(false);
      localStorage.removeItem('draft-banner-dismissed');
    }
  };

  const handleStartFresh = () => {
    localStorage.removeItem('draft-quotation');
    localStorage.removeItem('draft-quotation-backup');
    localStorage.removeItem('pending-draft-restore');
    localStorage.setItem('draft-banner-dismissed', 'true');
    setIsVisible(false);
    console.log('🆕 Empezando cotización nueva');
  };

  const handleDismiss = () => {
    localStorage.setItem('draft-banner-dismissed', 'true');
    setIsVisible(false);
    console.log('❌ Banner descartado');
  };

  const formatTimeAgo = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    }
    const days = Math.floor(hours / 24);
    return `${days} día${days !== 1 ? 's' : ''}`;
  };

  if (!isVisible || !draftInfo) {
    return null;
  }

  const { data, timeAgo } = draftInfo;

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-blue-900">Borrador encontrado</span>
              <div className="flex items-center space-x-1 text-xs text-blue-600">
                <Clock className="h-3 w-3" />
                <span>hace {formatTimeAgo(timeAgo)}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs text-blue-700 mb-3">
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
                onClick={handleRestoreDraft}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4"
              >
                Continuar borrador
              </Button>
              <Button
                onClick={handleStartFresh}
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-100 text-xs h-8 px-4"
              >
                Empezar nuevo
              </Button>
            </div>
          </div>
        </div>

        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="sm"
          className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 p-1 h-7 w-7 ml-3 flex-shrink-0"
          title="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};