
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface OptimizedQuoteContextType {
  refreshData: () => void;
  isRefreshing: boolean;
}

const OptimizedQuoteContext = createContext<OptimizedQuoteContextType | undefined>(undefined);

interface OptimizedQuoteProviderProps {
  children: ReactNode;
}

export function OptimizedQuoteProvider({ children }: OptimizedQuoteProviderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const value = {
    refreshData,
    isRefreshing
  };

  return (
    <OptimizedQuoteContext.Provider value={value}>
      {children}
    </OptimizedQuoteContext.Provider>
  );
}

export function useOptimizedQuote() {
  const context = useContext(OptimizedQuoteContext);
  if (context === undefined) {
    throw new Error('useOptimizedQuote must be used within an OptimizedQuoteProvider');
  }
  return context;
}
