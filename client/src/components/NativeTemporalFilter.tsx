import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export interface TemporalFilterValue {
  mode: 'month' | 'quarter' | 'year' | 'custom';
  period?: string;
  year?: number;
  quarter?: number;
  from?: string;
  to?: string;
}

interface NativeTemporalFilterProps {
  value: TemporalFilterValue;
  onChange: (value: TemporalFilterValue) => void;
  className?: string;
}

const MODES = [
  { key: 'month', label: 'Mensual' },
  { key: 'quarter', label: 'Trimestral' },
  { key: 'year', label: 'Anual' },
  { key: 'custom', label: 'Rango' }
] as const;

const QUARTERS = [
  { value: 1, label: 'Q1 (Ene-Mar)' },
  { value: 2, label: 'Q2 (Abr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dic)' }
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function NativeTemporalFilter({ value, onChange, className = '' }: NativeTemporalFilterProps) {
  const currentDate = useMemo(() => {
    if (value.period) {
      const [year, month] = value.period.split('-').map(Number);
      return new Date(year, month - 1);
    }
    return new Date();
  }, [value.period]);

  const handleModeChange = (mode: TemporalFilterValue['mode']) => {
    if (mode === 'month') {
      const now = new Date();
      onChange({ 
        mode, 
        period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` 
      });
    } else if (mode === 'quarter') {
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
      onChange({ mode, year: currentYear, quarter: currentQuarter });
    } else if (mode === 'year') {
      onChange({ mode, year: currentYear });
    } else if (mode === 'custom') {
      const now = new Date();
      const threeMonthsAgo = subMonths(now, 3);
      onChange({ 
        mode, 
        from: `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`,
        to: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      });
    }
  };

  const handlePrevMonth = () => {
    const prev = subMonths(currentDate, 1);
    onChange({ 
      ...value, 
      period: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}` 
    });
  };

  const handleNextMonth = () => {
    const next = addMonths(currentDate, 1);
    onChange({ 
      ...value, 
      period: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}` 
    });
  };

  const handleMonthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      onChange({ ...value, period: val });
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, year: parseInt(e.target.value) });
  };

  const handleQuarterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, quarter: parseInt(e.target.value) });
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, from: e.target.value });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, to: e.target.value });
  };

  const getDisplayLabel = () => {
    if (value.mode === 'month' && value.period) {
      const [year, month] = value.period.split('-').map(Number);
      return format(new Date(year, month - 1), 'MMMM yyyy', { locale: es });
    }
    if (value.mode === 'quarter' && value.year && value.quarter) {
      return `Q${value.quarter} ${value.year}`;
    }
    if (value.mode === 'year' && value.year) {
      return `Año ${value.year}`;
    }
    if (value.mode === 'custom' && value.from && value.to) {
      return `${value.from} a ${value.to}`;
    }
    return 'Seleccionar período';
  };

  return (
    <div className={`relative z-50 pointer-events-auto ${className}`} data-testid="temporal-filter">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="font-medium text-gray-700">Filtro Temporal</span>
        </div>
        
        {/* Mode Selector - Tab Style */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-4" data-testid="mode-selector">
          {MODES.map((mode) => (
            <button
              key={mode.key}
              onClick={() => handleModeChange(mode.key)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                value.mode === mode.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid={`mode-${mode.key}`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Month Selector */}
        {value.mode === 'month' && (
          <div className="flex items-center gap-2" data-testid="month-controls">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              data-testid="btn-prev-month"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            
            <div className="flex-1 relative">
              <input
                type="month"
                value={value.period || ''}
                onChange={handleMonthInputChange}
                className="w-full px-4 py-2 text-center font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                data-testid="input-month"
              />
            </div>
            
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              data-testid="btn-next-month"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        )}

        {/* Quarter Selector */}
        {value.mode === 'quarter' && (
          <div className="flex gap-3" data-testid="quarter-controls">
            <select
              value={value.year || currentYear}
              onChange={handleYearChange}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              data-testid="select-year"
            >
              {YEARS.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={value.quarter || 1}
              onChange={handleQuarterChange}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              data-testid="select-quarter"
            >
              {QUARTERS.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Year Selector */}
        {value.mode === 'year' && (
          <div data-testid="year-controls">
            <select
              value={value.year || currentYear}
              onChange={handleYearChange}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-center font-medium"
              data-testid="select-year"
            >
              {YEARS.map(year => (
                <option key={year} value={year}>Año {year}</option>
              ))}
            </select>
          </div>
        )}

        {/* Custom Range Selector */}
        {value.mode === 'custom' && (
          <div className="flex items-center gap-3" data-testid="custom-controls">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input
                type="month"
                value={value.from || ''}
                onChange={handleFromChange}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                data-testid="input-from"
              />
            </div>
            <span className="text-gray-400 mt-5">→</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input
                type="month"
                value={value.to || ''}
                onChange={handleToChange}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                data-testid="input-to"
              />
            </div>
          </div>
        )}

        {/* Current Selection Display */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Período seleccionado:</span>
            <span className="font-semibold text-blue-600 capitalize" data-testid="display-period">
              {getDisplayLabel()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
