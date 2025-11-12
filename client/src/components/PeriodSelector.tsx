import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

export interface TimeFilter {
  timeMode: 'month' | 'bimonth' | 'quarter' | 'semester' | 'year' | 'custom';
  period?: string;
  year?: number;
  index?: number;
  from?: string;
  to?: string;
}

interface PeriodSelectorProps {
  availablePeriods?: { key: string; label: string }[];
  defaultPeriod?: string | null;
  value?: TimeFilter;
  onChange: (filter: TimeFilter) => void;
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);

const BIMONTH_OPTIONS = [
  { value: 1, label: 'Ene-Feb' },
  { value: 2, label: 'Mar-Abr' },
  { value: 3, label: 'May-Jun' },
  { value: 4, label: 'Jul-Ago' },
  { value: 5, label: 'Sep-Oct' },
  { value: 6, label: 'Nov-Dic' }
];

const QUARTER_OPTIONS = [
  { value: 1, label: 'Q1 (Ene-Mar)' },
  { value: 2, label: 'Q2 (Abr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dic)' }
];

const SEMESTER_OPTIONS = [
  { value: 1, label: 'S1 (Ene-Jun)' },
  { value: 2, label: 'S2 (Jul-Dic)' }
];

export default function PeriodSelector({ 
  availablePeriods = [], 
  defaultPeriod,
  value,
  onChange 
}: PeriodSelectorProps) {
  const [timeMode, setTimeMode] = useState<TimeFilter['timeMode']>(value?.timeMode || 'month');
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(value?.period || defaultPeriod || undefined);
  const [selectedYear, setSelectedYear] = useState<number>(value?.year || currentYear);
  const [selectedIndex, setSelectedIndex] = useState<number>(value?.index || 1);
  const [fromDate, setFromDate] = useState<string>(value?.from || '');
  const [toDate, setToDate] = useState<string>(value?.to || '');

  useEffect(() => {
    if (!value?.period && defaultPeriod) {
      setSelectedPeriod(defaultPeriod);
    }
  }, [defaultPeriod, value]);

  useEffect(() => {
    let filter: TimeFilter;
    
    switch (timeMode) {
      case 'month':
        filter = { timeMode: 'month', period: selectedPeriod };
        break;
      case 'bimonth':
        filter = { timeMode: 'bimonth', year: selectedYear, index: selectedIndex };
        break;
      case 'quarter':
        filter = { timeMode: 'quarter', year: selectedYear, index: selectedIndex };
        break;
      case 'semester':
        filter = { timeMode: 'semester', year: selectedYear, index: selectedIndex };
        break;
      case 'year':
        filter = { timeMode: 'year', year: selectedYear };
        break;
      case 'custom':
        if (fromDate && toDate) {
          filter = { timeMode: 'custom', from: fromDate, to: toDate };
        } else {
          return;
        }
        break;
      default:
        return;
    }
    
    onChange(filter);
  }, [timeMode, selectedPeriod, selectedYear, selectedIndex, fromDate, toDate]);

  const handleTimeModeChange = (mode: string) => {
    setTimeMode(mode as TimeFilter['timeMode']);
  };

  return (
    <div className="space-y-4" data-testid="period-selector">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="time-mode">Tipo de período</Label>
          <Select value={timeMode} onValueChange={handleTimeModeChange}>
            <SelectTrigger id="time-mode" data-testid="select-timemode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mensual</SelectItem>
              <SelectItem value="bimonth">Bimestral</SelectItem>
              <SelectItem value="quarter">Trimestral</SelectItem>
              <SelectItem value="semester">Semestral</SelectItem>
              <SelectItem value="year">Anual</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {timeMode === 'month' && (
          <div className="space-y-2">
            <Label htmlFor="month-period">Mes</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger id="month-period" data-testid="select-month">
                <SelectValue placeholder="Seleccionar mes" />
              </SelectTrigger>
              <SelectContent>
                {availablePeriods.map(p => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(timeMode === 'bimonth' || timeMode === 'quarter' || timeMode === 'semester' || timeMode === 'year') && (
          <div className="space-y-2">
            <Label htmlFor="year">Año</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger id="year" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {timeMode === 'bimonth' && (
          <div className="space-y-2">
            <Label htmlFor="bimonth">Bimestre</Label>
            <Select value={selectedIndex.toString()} onValueChange={(v) => setSelectedIndex(parseInt(v))}>
              <SelectTrigger id="bimonth" data-testid="select-bimonth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BIMONTH_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {timeMode === 'quarter' && (
          <div className="space-y-2">
            <Label htmlFor="quarter">Trimestre</Label>
            <Select value={selectedIndex.toString()} onValueChange={(v) => setSelectedIndex(parseInt(v))}>
              <SelectTrigger id="quarter" data-testid="select-quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {timeMode === 'semester' && (
          <div className="space-y-2">
            <Label htmlFor="semester">Semestre</Label>
            <Select value={selectedIndex.toString()} onValueChange={(v) => setSelectedIndex(parseInt(v))}>
              <SelectTrigger id="semester" data-testid="select-semester">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {timeMode === 'custom' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="from-date">Desde</Label>
              <Input
                id="from-date"
                type="month"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-testid="input-from-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">Hasta</Label>
              <Input
                id="to-date"
                type="month"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                data-testid="input-to-date"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
