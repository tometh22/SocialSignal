import { useState } from "react";
import { 
  HelpCircle, 
  Book, 
  FileQuestion, 
  MessageSquare, 
  ArrowRight, 
  ChevronRight,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type HelpTopic = {
  id: string;
  title: string;
  content: string;
  category: string;
};

const commonTopics: HelpTopic[] = [
  {
    id: "1",
    title: "¿Cómo crear una nueva cotización?",
    content: "Para crear una nueva cotización, navega a la sección 'Nueva cotización' desde el menú lateral. Allí podrás seleccionar una plantilla, agregar los detalles del proyecto y calcular los costos.",
    category: "Cotizaciones"
  },
  {
    id: "2",
    title: "¿Cómo asignar un cliente a un proyecto?",
    content: "En la vista de 'Proyectos Activos', busca el proyecto al que deseas asignar un cliente. Si el proyecto no tiene cliente, verás un icono para asignar cliente. Haz clic en ese icono y selecciona el cliente de la lista desplegable.",
    category: "Proyectos"
  },
  {
    id: "3",
    title: "¿Cómo registrar horas de trabajo?",
    content: "Navega a la vista de 'Proyectos Activos', selecciona el proyecto y haz clic en el icono de reloj para acceder al registro de horas. Allí podrás agregar nuevas entradas de tiempo especificando fecha, horas, rol y descripción.",
    category: "Tiempo"
  }
];

export function HelpPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<'main' | 'topic' | 'search'>('main');
  const [activeTopic, setActiveTopic] = useState<HelpTopic | null>(null);
  
  const filteredTopics = searchTerm 
    ? commonTopics.filter(topic => 
        topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        topic.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];
    
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setActiveView('search');
    }
  };
  
  const handleTopicSelect = (topic: HelpTopic) => {
    setActiveTopic(topic);
    setActiveView('topic');
  };
  
  const handleBack = () => {
    if (activeView === 'topic' || activeView === 'search') {
      setActiveView('main');
      setSearchTerm("");
    }
  };

  const renderMainView = () => (
    <div className="space-y-4">
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar ayuda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </form>
      
      <div>
        <h3 className="text-sm font-medium mb-2">Temas comunes</h3>
        <div className="space-y-1">
          {commonTopics.map((topic) => (
            <button
              key={topic.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md flex justify-between items-center"
              onClick={() => handleTopicSelect(topic)}
            >
              <span>{topic.title}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
      
      <DropdownMenuSeparator />
      
      <DropdownMenuGroup>
        <h3 className="text-sm font-medium mb-2">Recursos adicionales</h3>
        <div className="grid grid-cols-2 gap-2">
          <DropdownMenuItem asChild className="h-auto p-0 focus:bg-transparent">
            <a href="/documentation" className="flex flex-col items-center p-3 hover:bg-muted rounded-md">
              <Book className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs font-medium">Documentación</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-auto p-0 focus:bg-transparent">
            <a href="/faq" className="flex flex-col items-center p-3 hover:bg-muted rounded-md">
              <FileQuestion className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs font-medium">Preguntas</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-auto p-0 focus:bg-transparent">
            <a href="/support" className="flex flex-col items-center p-3 hover:bg-muted rounded-md">
              <MessageSquare className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs font-medium">Soporte</span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-auto p-0 focus:bg-transparent">
            <a href="/tutorials" className="flex flex-col items-center p-3 hover:bg-muted rounded-md">
              <HelpCircle className="h-5 w-5 mb-1 text-primary" />
              <span className="text-xs font-medium">Tutoriales</span>
            </a>
          </DropdownMenuItem>
        </div>
      </DropdownMenuGroup>
    </div>
  );
  
  const renderTopicView = () => activeTopic ? (
    <div className="space-y-4">
      <Button 
        variant="ghost" 
        size="sm"
        className="text-xs pl-1 -ml-2"
        onClick={handleBack}
      >
        <ArrowRight className="h-3.5 w-3.5 mr-1 rotate-180" />
        Volver
      </Button>
      
      <div>
        <h3 className="text-sm font-medium mb-1">{activeTopic.title}</h3>
        <p className="text-xs text-muted-foreground mb-2">Categoría: {activeTopic.category}</p>
        <p className="text-sm">{activeTopic.content}</p>
      </div>
      
      <DropdownMenuSeparator />
      
      <div>
        <h4 className="text-sm font-medium mb-2">¿Te ayudó esta respuesta?</h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs">Sí, gracias</Button>
          <Button variant="outline" size="sm" className="text-xs">No, necesito más ayuda</Button>
        </div>
      </div>
    </div>
  ) : null;
  
  const renderSearchResults = () => (
    <div className="space-y-4">
      <Button 
        variant="ghost" 
        size="sm"
        className="text-xs pl-1 -ml-2"
        onClick={handleBack}
      >
        <ArrowRight className="h-3.5 w-3.5 mr-1 rotate-180" />
        Volver
      </Button>
      
      <div>
        <h3 className="text-sm font-medium mb-2">Resultados para: "{searchTerm}"</h3>
        {filteredTopics.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {filteredTopics.map((topic) => (
              <AccordionItem key={topic.id} value={topic.id}>
                <AccordionTrigger className="text-sm py-2">{topic.title}</AccordionTrigger>
                <AccordionContent className="text-xs">{topic.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-sm text-muted-foreground">No se encontraron resultados para tu búsqueda.</p>
        )}
      </div>
      
      <DropdownMenuSeparator />
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-2">¿No encuentras lo que buscas?</p>
        <Button variant="outline" size="sm" className="text-xs w-full">
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
          Contactar a soporte
        </Button>
      </div>
    </div>
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4.5 w-4.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-4">
          <DropdownMenuLabel className={cn(
            "px-0 flex items-center justify-between",
            activeView !== 'main' ? "mb-0" : ""
          )}>
            <span>Centro de Ayuda</span>
          </DropdownMenuLabel>
          
          {activeView === 'main' && renderMainView()}
          {activeView === 'topic' && renderTopicView()}
          {activeView === 'search' && renderSearchResults()}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}