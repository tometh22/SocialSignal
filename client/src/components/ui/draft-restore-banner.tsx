
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
    
    // Force check for all possible draft sources
    const checkForDrafts = () => {
      try {
        // Check for pending draft restore first
        let pendingDraft = localStorage.getItem('pending-draft-restore');
        console.log('🔍 DRAFT RESTORE BANNER - Pending draft:', pendingDraft);

        // If no pending draft, check for actual draft data
        if (!pendingDraft) {
          const draft = localStorage.getItem('draft-quotation');
          const backup = localStorage.getItem('draft-quotation-backup');
          
          console.log('🔍 DRAFT RESTORE BANNER - Draft found:', !!draft);
          console.log('🔍 DRAFT RESTORE BANNER - Backup found:', !!backup);
          
          if (draft || backup) {
            try {
              let savedData = null;
              let timestamp = 0;
              let source = '';

              if (draft) {
                const draftParsed = JSON.parse(draft);
                savedData = draftParsed.quotationData;
                timestamp = draftParsed.timestamp;
                source = 'autoguardado';
              } else if (backup) {
                const backupParsed = JSON.parse(backup);
                savedData = backupParsed.quotationData;
                timestamp = backupParsed.timestamp;
                source = 'respaldo';
              }

              const timeAgo = Math.round((Date.now() - timestamp) / (1000 * 60));
              const isRecent = Date.now() - timestamp < 48 * 60 * 60 * 1000;
              
              if (isRecent && savedData && !localStorage.getItem('draft-banner-dismissed')) {
                // Create pending draft for banner
                const draftInfo = {
                  data: savedData,
                  timestamp: timestamp,
                  source: source,
                  timeAgo: timeAgo
                };
                
                localStorage.setItem('pending-draft-restore', JSON.stringify(draftInfo));
                setDraftInfo(draftInfo);
                setIsVisible(true);
                console.log('✅ DRAFT RESTORE BANNER - Banner activated from direct draft check');
                return;
              }
            } catch (parseError) {
              console.error('❌ Error parsing draft data:', parseError);
            }
          }
        } else {
          // Process existing pending draft
          const parsed = JSON.parse(pendingDraft);
          console.log('🔍 DRAFT RESTORE BANNER - Parsed pending draft:', parsed);
          
          if (parsed.data && typeof parsed.timeAgo === 'number') {
            setDraftInfo(parsed);
            setIsVisible(true);
            console.log('✅ DRAFT RESTORE BANNER - Banner should be visible now');
          } else {
            console.warn('⚠️ DRAFT RESTORE BANNER - Invalid draft data structure');
            localStorage.removeItem('pending-draft-restore');
          }
        }
      } catch (error) {
        console.error('❌ DRAFT RESTORE BANNER - Error in useEffect:', error);
        localStorage.removeItem('pending-draft-restore');
      }
    };

    checkForDrafts();
  }, []);

  const handleRestoreDraft = () => {
    if (draftInfo?.data) {
      setQuotationData(draftInfo.data);
      localStorage.removeItem('draft-banner-dismissed'); // Allow future drafts to show banner
      console.log('📋 Borrador restaurado desde banner');
      handleDismiss();
    }
  };

  const handleStartFresh = () => {
    // Clear all draft data
    localStorage.removeItem('draft-quotation');
    localStorage.removeItem('draft-quotation-backup');
    localStorage.removeItem('pending-draft-restore');
    localStorage.setItem('draft-banner-dismissed', 'true');
    console.log('🆕 Usuario eligió empezar de nuevo');
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.removeItem('pending-draft-restore');
    localStorage.setItem('draft-banner-dismissed', 'true');
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
    <div className={`mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm ${!isVisible || !draftInfo ? 'hidden' : ''}`}>
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
