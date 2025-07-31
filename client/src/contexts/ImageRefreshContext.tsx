import React, { createContext, useContext, useState } from 'react';

interface ImageRefreshContextType {
  refreshTimestamp: number;
  forceRefresh: () => void;
}

const ImageRefreshContext = createContext<ImageRefreshContextType | undefined>(undefined);

export const useImageRefresh = () => {
  const context = useContext(ImageRefreshContext);
  if (!context) {
    throw new Error('useImageRefresh must be used within an ImageRefreshProvider');
  }
  return context;
};

export const ImageRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now());

  const forceRefresh = () => {
    setRefreshTimestamp(Date.now());
  };

  return (
    <ImageRefreshContext.Provider value={{ refreshTimestamp, forceRefresh }}>
      {children}
    </ImageRefreshContext.Provider>
  );
};