
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

  // Banner invisible pero funcional - auto-restaura el borrador sin mostrar UI
  useEffect(() => {
    if (isVisible && draftInfo) {
      // Auto-restaurar el borrador silenciosamente después de un pequeño delay
      const timer = setTimeout(() => {
        handleRestoreDraft();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, draftInfo]);

  // No renderizar nada - funcionalidad invisible
  return null;
};
