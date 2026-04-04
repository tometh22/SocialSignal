import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authFetch } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, TrendingUp, Calendar, DollarSign } from 'lucide-react';

interface ExchangeRate {
  id: number;
  year: number;
  month: number;
  exchangeRate: number;
  rateType: string;
  source: string;
  createdAt: string;
}

interface CurrencyConverterProps {
  className?: string;
}

export function CurrencyConverter({ className }: CurrencyConverterProps) {
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ExchangeRate | null>(null);
  const [usdAmount, setUsdAmount] = useState<string>('1000');
  const [arsAmount, setArsAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [conversionMode, setConversionMode] = useState<'usd-to-ars' | 'ars-to-usd'>('usd-to-ars');

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      const response = await authFetch('/api/exchange-rates');
      if (response.ok) {
        const rates = await response.json();
        setExchangeRates(rates);
        // Select the most recent rate by default
        if (rates.length > 0) {
          setSelectedRate(rates[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRate) {
      convertCurrency();
    }
  }, [selectedRate, usdAmount, arsAmount, conversionMode]);

  const convertCurrency = () => {
    if (!selectedRate) return;

    if (conversionMode === 'usd-to-ars') {
      const usd = parseFloat(usdAmount) || 0;
      const ars = usd * selectedRate.exchangeRate;
      setArsAmount(ars.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
      const ars = parseFloat(arsAmount.replace(/,/g, '')) || 0;
      const usd = ars / selectedRate.exchangeRate;
      setUsdAmount(usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  const handleUsdChange = (value: string) => {
    setUsdAmount(value);
    setConversionMode('usd-to-ars');
  };

  const handleArsChange = (value: string) => {
    setArsAmount(value);
    setConversionMode('ars-to-usd');
  };

  const swapCurrencies = () => {
    setConversionMode(conversionMode === 'usd-to-ars' ? 'ars-to-usd' : 'usd-to-ars');
  };

  const formatRateDate = (year: number, month: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${months[month - 1]} ${year}`;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Conversor de Monedas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Cargando tipos de cambio...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Conversor USD ↔ ARS
        </CardTitle>
        {selectedRate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Tipo de cambio del {formatRateDate(selectedRate.year, selectedRate.month)}
            <Badge variant="secondary" className="ml-2">
              {selectedRate.source}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selector de fecha */}
        <div className="grid grid-cols-1 gap-2">
          <Label>Período de tipo de cambio</Label>
          <Select
            value={selectedRate?.id.toString() || ''}
            onValueChange={(value) => {
              const rate = exchangeRates.find(r => r.id.toString() === value);
              setSelectedRate(rate || null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar período" />
            </SelectTrigger>
            <SelectContent>
              {exchangeRates.map((rate) => (
                <SelectItem key={rate.id} value={rate.id.toString()}>
                  {formatRateDate(rate.year, rate.month)} - ARS ${rate.exchangeRate.toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conversor */}
        {selectedRate && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg font-medium">
                <TrendingUp className="h-4 w-4" />
                1 USD = ARS ${selectedRate.exchangeRate.toFixed(2)}
              </div>
            </div>

            {/* Campos de conversión */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label>Dólares (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="text"
                    value={usdAmount}
                    onChange={(e) => handleUsdChange(e.target.value)}
                    className="pl-6"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={swapCurrencies}
                  className="rounded-full"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Pesos (ARS)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="text"
                    value={arsAmount}
                    onChange={(e) => handleArsChange(e.target.value)}
                    className="pl-6"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            {/* Información adicional */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="font-medium text-primary">Cotización Oficial</div>
                <div className="text-muted-foreground">BCRA</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="font-medium text-primary">
                  {exchangeRates.length} períodos
                </div>
                <div className="text-muted-foreground">Disponibles</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}