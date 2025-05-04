import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Bell,
  Search,
  ChevronDown,
  CheckCircle,
  Info,
  Clock,
  LogOut,
  User,
  Settings,
  HelpCircle,
  Moon,
  Sun,
  CreditCard,
  Calendar,
  ChevronRight,
  MessageSquare
} from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href: string;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'success' | 'info' | 'warning';
};

export default function EnhancedTopbar() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Cotización aprobada',
      message: 'La cotización para Acme Corp ha sido aprobada',
      time: 'hace 10 min',
      read: false,
      type: 'success'
    },
    {
      id: '2',
      title: 'Nuevo comentario',
      message: 'Juan ha comentado en el proyecto Alpha',
      time: 'hace 30 min',
      read: false,
      type: 'info'
    },
    {
      id: '3',
      title: 'Reunión programada',
      message: 'Reunión de planificación a las 15:00',
      time: 'hace 1h',
      read: true,
      type: 'warning'
    }
  ]);
  
  // Detectar scroll para cambiar apariencia
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Generar migas de pan (breadcrumbs)
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (location === '/') return [{ label: 'Dashboard', href: '/' }];
    
    const pathSegments = location.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/' }];
    
    const segmentLabels: Record<string, string> = {
      'optimized-quote': 'Nueva Cotización',
      'manage-quotes': 'Gestionar Cotizaciones',
      'active-projects': 'Proyectos Activos',
      'clients': 'Clientes',
      'statistics': 'Estadísticas',
      'admin': 'Configuración'
    };
    
    let currentPath = '';
    pathSegments.forEach(segment => {
      currentPath += `/${segment}`;
      breadcrumbs.push({
        label: segmentLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
        href: currentPath
      });
    });
    
    return breadcrumbs;
  };

  // Marcar notificación como leída
  const markAsRead = (id: string) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  // Marcar todas como leídas
  const markAllAsRead = () => {
    setNotifications(notifications.map(notif => ({ ...notif, read: true })));
  };

  // Contar notificaciones no leídas
  const unreadCount = notifications.filter(n => !n.read).length;

  const breadcrumbs = generateBreadcrumbs();

  return (
    <header 
      className={cn(
        "sticky top-0 z-30 w-full transition-all duration-200",
        isScrolled 
          ? "bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm" 
          : "bg-white border-b border-gray-100"
      )}
    >
      <div className="h-16 px-4 flex items-center justify-between">
        {/* Breadcrumbs (Izquierda) */}
        <div className="flex items-center">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-1">
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400 mx-1" />}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-sm font-medium text-gray-800">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link 
                      href={crumb.href}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          
          {breadcrumbs.length > 1 && (
            <Badge variant="outline" className="ml-4 bg-blue-50 text-blue-700 border-blue-100 text-xs">
              {breadcrumbs[breadcrumbs.length - 1].label}
            </Badge>
          )}
        </div>

        {/* Acciones (Derecha) */}
        <div className="flex items-center gap-1">
          {/* Busqueda global */}
          <div className={cn(
            "relative transition-all duration-200",
            isSearchFocused ? "w-64" : "w-48"
          )}>
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="h-9 pl-8 pr-4 w-full text-sm bg-gray-50 border-gray-200 focus:bg-white"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center ml-2">
            {/* Tema (claro/oscuro) */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500">
                    <Sun className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Cambiar tema</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Calendario */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500">
                    <Calendar className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Calendario</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Mensajes */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500">
                    <MessageSquare className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Mensajes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Notificaciones */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-500 relative">
                  <Bell className="h-[18px] w-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[350px]">
                <div className="flex items-center justify-between px-4 py-2">
                  <DropdownMenuLabel className="px-0 py-0 font-semibold text-gray-900">
                    Notificaciones
                  </DropdownMenuLabel>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={markAllAsRead}
                      className="h-8 text-xs text-blue-600 font-medium"
                    >
                      Marcar todas como leídas
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                
                {/* Lista de notificaciones */}
                <div className="max-h-[300px] overflow-y-auto py-1">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={cn(
                          "flex p-0 focus:bg-gray-50 cursor-default",
                          !notification.read && "bg-blue-50/50"
                        )}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div 
                          className="py-2 px-4 w-full"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex gap-3 w-full">
                            <div className={cn(
                              "h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0",
                              notification.type === 'success' && "bg-green-100 text-green-600",
                              notification.type === 'info' && "bg-blue-100 text-blue-600",
                              notification.type === 'warning' && "bg-amber-100 text-amber-600"
                            )}>
                              {notification.type === 'success' && <CheckCircle className="h-5 w-5" />}
                              {notification.type === 'info' && <Info className="h-5 w-5" />}
                              {notification.type === 'warning' && <Clock className="h-5 w-5" />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <p className={cn(
                                  "text-sm",
                                  notification.read ? "font-medium text-gray-700" : "font-semibold text-gray-900"
                                )}>
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-500 pl-2 flex-shrink-0">
                                  {notification.time}
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="py-8 text-center text-gray-500 text-sm">
                      No hay notificaciones
                    </div>
                  )}
                </div>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="justify-center focus:bg-transparent">
                  <Link href="/notifications" className="text-xs text-blue-600 font-medium py-2">
                    Ver todas las notificaciones
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separador vertical */}
            <div className="h-6 w-px bg-gray-200 mx-2"></div>

            {/* Perfil de usuario */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="p-1.5 h-auto flex items-center gap-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <Avatar className="h-7 w-7 border border-gray-200">
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      JS
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center">
                    <span className="text-sm font-medium">Jane</span>
                    <ChevronDown className="h-4 w-4 ml-0.5 text-gray-500" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-3 flex items-center gap-3 border-b border-gray-100">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-600 text-white">
                      JS
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Jane Smith</p>
                    <p className="text-xs text-gray-500">Administrador</p>
                  </div>
                </div>
                
                <div className="py-1">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    <span>Mi Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    <span>Configuración</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Ayuda</span>
                  </DropdownMenuItem>
                </div>
                
                <DropdownMenuSeparator />
                
                <div className="py-1">
                  <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700">
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}