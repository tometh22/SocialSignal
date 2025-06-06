import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Filter, X, Calendar, User, Clock } from "lucide-react";

interface TimeEntriesFilterProps {
  timeEntries: Array<{
    id: number;
    personnelId: number;
    personnelName: string;
    date: Date | string;
    hours: number;
    description?: string;
    roleName?: string;
  }>;
  personnel: Array<{
    id: number;
    name: string;
    roleId: number;
  }>;
  onFilteredEntriesChange: (entries: any[]) => void;
}

export function TimeEntriesFilter({
  timeEntries,
  personnel,
  onFilteredEntriesChange
}: TimeEntriesFilterProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [hoursFilter, setHoursFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Aplicar filtros en tiempo real
  const applyFilters = () => {
    let filtered = [...timeEntries];

    // Filtro de búsqueda de texto
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.personnelName?.toLowerCase().includes(searchLower) ||
        entry.description?.toLowerCase().includes(searchLower) ||
        entry.roleName?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por persona
    if (selectedPerson !== "all") {
      filtered = filtered.filter(entry => entry.personnelId.toString() === selectedPerson);
    }

    // Filtro por fecha
    if (dateFilter !== "all") {
      const now = new Date();
      const entryDate = new Date();
      
      filtered = filtered.filter(entry => {
        const entryDate = new Date(entry.date);
        
        switch (dateFilter) {
          case "today":
            return entryDate.toDateString() === now.toDateString();
          case "week":
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            return entryDate >= weekAgo;
          case "month":
            const monthAgo = new Date(now);
            monthAgo.setMonth(now.getMonth() - 1);
            return entryDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Filtro por horas
    if (hoursFilter !== "all") {
      filtered = filtered.filter(entry => {
        switch (hoursFilter) {
          case "low":
            return entry.hours <= 2;
          case "medium":
            return entry.hours > 2 && entry.hours <= 6;
          case "high":
            return entry.hours > 6;
          default:
            return true;
        }
      });
    }

    onFilteredEntriesChange(filtered);
  };

  // Aplicar filtros cada vez que cambien los valores
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedPerson, dateFilter, hoursFilter, timeEntries]);

  // Limpiar todos los filtros
  const clearAllFilters = () => {
    setSearchText("");
    setSelectedPerson("all");
    setDateFilter("all");
    setHoursFilter("all");
  };

  // Contar filtros activos
  const activeFiltersCount = [
    searchText.trim() ? 1 : 0,
    selectedPerson !== "all" ? 1 : 0,
    dateFilter !== "all" ? 1 : 0,
    hoursFilter !== "all" ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {/* Barra de búsqueda principal */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por persona, descripción o rol..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Panel de filtros avanzados */}
        {showFilters && (
          <div className="border-t pt-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Filtro por persona */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Persona
                </label>
                <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las personas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las personas</SelectItem>
                    {personnel.map(person => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por fecha */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Período
                </label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las fechas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="month">Último mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por horas */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Horas
                </label>
                <Select value={hoursFilter} onValueChange={setHoursFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las horas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las horas</SelectItem>
                    <SelectItem value="low">1-2 horas</SelectItem>
                    <SelectItem value="medium">3-6 horas</SelectItem>
                    <SelectItem value="high">6+ horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Botón para limpiar filtros */}
            {activeFiltersCount > 0 && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-gray-600">
                  {timeEntries.length} entrada{timeEntries.length !== 1 ? 's' : ''} encontrada{timeEntries.length !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Badges de filtros activos */}
        {activeFiltersCount > 0 && !showFilters && (
          <div className="flex flex-wrap gap-2 mt-2">
            {searchText.trim() && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Búsqueda: "{searchText}"
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-600" 
                  onClick={() => setSearchText("")}
                />
              </Badge>
            )}
            {selectedPerson !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Persona: {personnel.find(p => p.id.toString() === selectedPerson)?.name}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-600" 
                  onClick={() => setSelectedPerson("all")}
                />
              </Badge>
            )}
            {dateFilter !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Período: {dateFilter === "today" ? "Hoy" : dateFilter === "week" ? "Última semana" : "Último mes"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-600" 
                  onClick={() => setDateFilter("all")}
                />
              </Badge>
            )}
            {hoursFilter !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Horas: {hoursFilter === "low" ? "1-2h" : hoursFilter === "medium" ? "3-6h" : "6+h"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-600" 
                  onClick={() => setHoursFilter("all")}
                />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}