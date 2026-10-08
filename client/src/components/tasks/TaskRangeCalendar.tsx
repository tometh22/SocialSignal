import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

/** Popovers mount this draft on open; closing without a complete range discards it. */
export default function TaskRangeCalendar({ selected, onSelect, ...props }: {
  selected?: DateRange; onSelect: (range: DateRange | undefined) => void; mode?: "range"; locale?: unknown; initialFocus?: boolean;
}) {
  const [draft, setDraft] = useState<DateRange | undefined>(selected);
  useEffect(() => { setDraft(selected); }, [selected?.from?.getTime(), selected?.to?.getTime()]);
  return <div>
    <Calendar {...props} mode="range" locale={es} selected={draft} onSelect={range => {
      setDraft(range);
      if (range?.from && range.to) onSelect(range);
    }} />
    {draft?.from && !draft.to && <Button variant="ghost" size="sm" className="m-2" onClick={() => onSelect({ from: draft.from, to: draft.from })}>Usar un día</Button>}
  </div>;
}

