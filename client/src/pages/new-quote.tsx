import QuoteWizard from "@/components/quotation/quote-wizard";
import { QuoteProvider } from "@/context/quote-context";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, RotateCcw, X, Info } from "lucide-react";

export default function NewQuote() {
  const [pendingDraft, setPendingDraft] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check for pending draft
    console.log('🔍 NEW QUOTE - Checking for pending draft...');
    const draftInfo = localStorage.getItem('pending-draft-restore');
    console.log('🔍 Draft info from localStorage:', draftInfo);
    
    if (draftInfo) {
      try {
        const parsed = JSON.parse(draftInfo);
        console.log('🔍 Parsed draft info:', parsed);
        setPendingDraft(parsed);
        setShowBanner(true);
        console.log('✅ Banner should show now');
      } catch (error) {
        console.error('❌ Error parsing draft info:', error);
        localStorage.removeItem('pending-draft-restore');
      }
    } else {
      console.log('ℹ️ No pending draft found');
      
      // Also check for regular draft
      const regularDraft = localStorage.getItem('draft-quotation');
      console.log('🔍 Regular draft found:', !!regularDraft);
      if (regularDraft) {
        console.log('🔍 Regular draft content:', regularDraft.substring(0, 100) + '...');
      }
      
      // Check all localStorage keys related to drafts
      const allKeys = Object.keys(localStorage).filter(key => key.includes('draft'));
      console.log('🔍 All draft-related localStorage keys:', allKeys);
    }
  }, []);

  const handleRestoreDraft = () => {
    if (pendingDraft?.data) {
      // Trigger restore by setting the draft back to main storage
      localStorage.setItem('draft-quotation', JSON.stringify({
        quotationData: pendingDraft.data,
        timestamp: pendingDraft.timestamp
      }));
      
      // Clear pending restore
      localStorage.removeItem('pending-draft-restore');
      
      // Reload page to trigger restore
      window.location.reload();
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.removeItem('pending-draft-restore');
  };

  const formatTimeAgo = (minutes: number) => {
    if (minutes < 60) return `hace ${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} horas`;
    const days = Math.floor(hours / 24);
    return `hace ${days} días`;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center h-16 px-4 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">Nueva Cotización de Social Listening</h2>
      </div>
      
      {/* Banner eliminado - ahora se maneja en optimized-quote.tsx */}nner}
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto wizard-container">
          <QuoteProvider>
            <QuoteWizard />
          </QuoteProvider>
        </div>
      </div>
    </div>
  );
}
