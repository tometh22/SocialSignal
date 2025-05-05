import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";

type UpcomingEvent = {
  id: number;
  title: string;
  date: Date;
  type: 'deadline' | 'meeting' | 'task';
  projectId?: number;
};

export function CalendarPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [, navigate] = useLocation();

  // Simulación de eventos próximos
  const upcomingEvents: UpcomingEvent[] = [
    {
      id: 1,
      title: "Entrega de diseño UX",
      date: new Date(new Date().setDate(new Date().getDate() + 2)),
      type: 'deadline',
      projectId: 1
    },
    {
      id: 2,
      title: "Reunión con cliente Acme",
      date: new Date(new Date().setDate(new Date().getDate() + 1)),
      type: 'meeting',
      projectId: 2
    },
    {
      id: 3,
      title: "Revisión sprint mensual",
      date: new Date(new Date().setDate(new Date().getDate() + 5)),
      type: 'task'
    }
  ];

  const navigateToTimeEntries = (projectId?: number) => {
    if (projectId) {
      navigate(`/active-projects/${projectId}/time-entries`);
    } else {
      navigate('/time-entries');
    }
    setIsOpen(false);
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const getEventTypeStyles = (type: string) => {
    switch (type) {
      case 'deadline':
        return "bg-red-100 text-red-800 border-red-300";
      case 'meeting':
        return "bg-blue-100 text-blue-800 border-blue-300";
      case 'task':
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <CalendarIcon className="h-4.5 w-4.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Tabs defaultValue="calendar">
          <div className="border-b px-3">
            <TabsList className="mt-2">
              <TabsTrigger value="calendar" className="text-xs">Calendario</TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs">Próximos Eventos</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="calendar" className="p-0">
            <div className="p-3 border-b flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={prevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-medium capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={nextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => date && setDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border-0 p-3"
            />
            
            <div className="border-t p-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => navigateToTimeEntries()}
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Ver Registros de Tiempo
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="upcoming" className="focus:outline-none">
            <div className="py-2">
              <h3 className="text-xs font-medium px-3 py-2 text-muted-foreground">Próximos eventos</h3>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event) => (
                    <div 
                      key={event.id}
                      className="px-3 py-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigateToTimeEntries(event.projectId)}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{event.title}</h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getEventTypeStyles(event.type)}`}>
                          {event.type === 'deadline' ? 'Entrega' : 
                           event.type === 'meeting' ? 'Reunión' : 'Tarea'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(event.date, "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No hay eventos próximos</p>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t p-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => navigate('/calendar')}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                Ver Calendario Completo
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}