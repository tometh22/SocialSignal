import { useQuery } from '@tanstack/react-query';

/**
 * Hook personalizado para manejo de conversiones de moneda
 * Utiliza la nueva API mejorada con conversión automática
 */
export const useCurrency = () => {
  // Obtener tipo de cambio actual desde la base de datos
  const { data: exchangeRate = 1200, isLoading: exchangeRateLoading } = useQuery({
    queryKey: ['/api/admin/system-config'],
    select: (data: any[]) => {
      const exchangeRateConfig = data?.find(config => config.configKey === 'usd_exchange_rate');
      return exchangeRateConfig?.configValue || 1200;
    }
  });

  // Función para convertir de USD a la moneda especificada
  const convertFromUSD = (amountUSD: number, toCurrency: string): number => {
    if (toCurrency === 'USD') return amountUSD;
    return Math.round(amountUSD * exchangeRate * 100) / 100;
  };

  // Función para convertir de cualquier moneda a USD
  const convertToUSD = (amount: number, fromCurrency: string): number => {
    if (fromCurrency === 'USD') return amount;
    return Math.round((amount / exchangeRate) * 10000) / 10000;
  };

  // Función para formatear moneda con prefijo correcto
  const formatCurrency = (amount: number, currency: string): string => {
    if (currency === 'USD') {
      return `USD ${amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    } else {
      return `ARS ${amount.toLocaleString('es-AR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })}`;
    }
  };

  // Función para obtener cotización con conversión automática
  const getQuotationInCurrency = async (quotationId: number, currency: string) => {
    const response = await fetch(`/api/quotations/${quotationId}/display/${currency}`);
    if (!response.ok) {
      throw new Error('Failed to fetch quotation with currency conversion');
    }
    return response.json();
  };

  return {
    exchangeRate,
    exchangeRateLoading,
    convertFromUSD,
    convertToUSD,
    formatCurrency,
    getQuotationInCurrency
  };
};

/**
 * Hook para obtener una cotización específica con conversión automática
 */
export const useQuotationWithCurrency = (quotationId?: number, currency: string = 'USD') => {
  return useQuery({
    queryKey: ['/api/quotations', quotationId, 'display', currency],
    queryFn: async () => {
      if (!quotationId) return null;
      const response = await fetch(`/api/quotations/${quotationId}/display/${currency}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quotation with currency conversion');
      }
      return response.json();
    },
    enabled: !!quotationId
  });
};