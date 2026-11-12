import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const months = Array.from({ length: 12 }, (_, i) =>
  new Date(2026, i, 1).toLocaleDateString("es-AR", { month: "short" }),
).map((m) => m.replace(".", ""));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "2026-11" → "Noviembre 2026", independiente del idioma del navegador. */
export const monthLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return capitalize(
    new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    }),
  ).replace(" de ", " ");
};

/**
 * Selector de período (YYYY-MM) en español rioplatense. Reemplaza al
 * `<input type="month">` nativo, que muestra el mes en el idioma del sistema.
 */
export function MonthPicker({
  value,
  onChange,
  label,
  placeholder = "Elegir mes",
  disabled = false,
  clearable = false,
  size = "default",
  className,
}: {
  value: string;
  onChange: (period: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = new Date();
  const selectedYear = value
    ? Number(value.slice(0, 4))
    : current.getFullYear();
  const [year, setYear] = useState(selectedYear);
  const pick = (period: string) => {
    onChange(period);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setYear(selectedYear);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={value ? `${label}: ${monthLabel(value)}` : label}
          disabled={disabled}
          className={cn(
            "justify-between gap-2 bg-background px-3 text-sm font-normal",
            size === "sm" ? "h-8" : "h-9",
            className,
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span className={cn(!value && "text-muted-foreground")}>
              {value ? monthLabel(value) : placeholder}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Año anterior"
            onClick={() => setYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Año siguiente"
            onClick={() => setYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div
          className="grid grid-cols-3 gap-1"
          role="listbox"
          aria-label={label}
        >
          {months.map((m, i) => {
            const period = `${year}-${String(i + 1).padStart(2, "0")}`;
            const selected = period === value;
            const isCurrent =
              year === current.getFullYear() && i === current.getMonth();
            return (
              <button
                key={period}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => pick(period)}
                className={cn(
                  "h-9 rounded-md text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selected
                    ? "bg-primary font-medium text-primary-foreground"
                    : "hover:bg-slate-100",
                  !selected && isCurrent && "font-semibold text-primary",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        {clearable && value && (
          <button
            type="button"
            className="mt-2 w-full rounded-md py-1.5 text-sm text-muted-foreground hover:bg-slate-100 hover:text-foreground"
            onClick={() => pick("")}
          >
            Quitar mes
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
