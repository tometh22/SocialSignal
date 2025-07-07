import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Clock, User, FileText, Users } from 'lucide-react';
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
    const draftInfo = localStorage.getItem('pending-draft-restore');
    console.log('🔍 DRAFT RESTORE BANNER - Draft info:', draftInfo);

    if (draftInfo) {
      try {
        const parsed = JSON.parse(draftInfo);
        console.log('🔍 DRAFT RESTORE BANNER - Parsed:', parsed);
        setDraftInfo(parsed);
        setIsVisible(true);
        console.log('✅ DRAFT RESTORE BANNER - Banner should be visible');
      } catch (error) {
        console.error('❌ DRAFT RESTORE BANNER - Error parsing:', error);
        localStorage.removeItem('pending-draft-restore');
      }
    } else {
      console.log('ℹ️ DRAFT RESTORE BANNER - No pending draft found');
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
    <Card className="mb-6 border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                Borrador encontrado
              </h3>
              <div className="text-sm text-blue-700 space-y-1">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <User className="h-4 w-4" />
                    <span>{data.client?.name || 'Sin cliente'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FileText className="h-4 w-4" />
                    <span>{data.project?.name || 'Sin nombre'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{data.teamMembers?.length || 0} miembros</span>
                  </div>
                </div>
                <p className="text-xs text-blue-600">
                  Guardado hace {formatTimeAgo(timeAgo)}
                </p>
              </div>
              <div className="flex items-center space-x-3 mt-3">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRestoreDraft}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Continuar con borrador
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartFresh}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Empezar nueva cotización
                </Button>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-blue-400 hover:text-blue-600 hover:bg-blue-100 p-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};