import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface DraftData {
  timestamp: number;
  data: any;
  clientName?: string;
  projectName?: string;
  estimatedHours?: number;
}

export const useDraftRecovery = () => {
  const [availableDrafts, setAvailableDrafts] = useState<DraftData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const DRAFT_KEYS = [
    'optimized-quote-draft',
    'optimized-quote-draft-backup',
    'optimized-quote-draft-emergency'
  ];

  const loadAvailableDrafts = () => {
    const drafts: DraftData[] = [];
    
    DRAFT_KEYS.forEach(key => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsedData = JSON.parse(stored);
          
          // Check if draft is not expired (48 hours)
          const now = Date.now();
          const draftAge = now - parsedData.timestamp;
          const maxAge = 48 * 60 * 60 * 1000; // 48 hours
          
          if (draftAge < maxAge) {
            // Extract useful info from the draft
            const draftInfo: DraftData = {
              timestamp: parsedData.timestamp,
              data: parsedData.data,
              clientName: parsedData.data?.clientName || parsedData.data?.selectedClient?.name,
              projectName: parsedData.data?.projectName || parsedData.data?.projectDescription,
              estimatedHours: parsedData.data?.totalHours || parsedData.data?.estimatedHours
            };
            
            drafts.push(draftInfo);
          } else {
            // Remove expired draft
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.error(`Error loading draft from ${key}:`, error);
        // Remove corrupted draft
        localStorage.removeItem(key);
      }
    });
    
    // Remove duplicates based on timestamp (keep most recent)
    const uniqueDrafts = drafts.filter((draft, index, self) => 
      index === self.findIndex(d => Math.abs(d.timestamp - draft.timestamp) < 1000)
    );
    
    setAvailableDrafts(uniqueDrafts);
    setIsLoading(false);
  };

  const deleteDraft = (timestamp: number) => {
    // Find and remove the draft with matching timestamp
    DRAFT_KEYS.forEach(key => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsedData = JSON.parse(stored);
          if (parsedData.timestamp === timestamp) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.error(`Error deleting draft from ${key}:`, error);
      }
    });
    
    // Refresh available drafts
    loadAvailableDrafts();
    
    toast({
      title: "Borrador eliminado",
      description: "El borrador ha sido eliminado correctamente.",
    });
  };

  const clearAllDrafts = () => {
    DRAFT_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
    
    setAvailableDrafts([]);
    
    toast({
      title: "Todos los borradores eliminados",
      description: "Se han eliminado todos los borradores guardados.",
    });
  };

  const getDraftData = (timestamp: number): any => {
    // Find the draft with matching timestamp
    for (const key of DRAFT_KEYS) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsedData = JSON.parse(stored);
          if (parsedData.timestamp === timestamp) {
            return parsedData.data;
          }
        }
      } catch (error) {
        console.error(`Error getting draft data from ${key}:`, error);
      }
    }
    return null;
  };

  // Check if there are any drafts available
  const hasDrafts = availableDrafts.length > 0;

  // Get the most recent draft
  const getMostRecentDraft = (): DraftData | null => {
    if (availableDrafts.length === 0) return null;
    return availableDrafts.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  };

  useEffect(() => {
    loadAvailableDrafts();
  }, []);

  return {
    availableDrafts,
    isLoading,
    hasDrafts,
    loadAvailableDrafts,
    deleteDraft,
    clearAllDrafts,
    getDraftData,
    getMostRecentDraft
  };
};