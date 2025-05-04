import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Calendar,
  CheckCircle,
  ChevronsRight,
  HelpCircle,
  MessageSquare,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  Moon,
  Sun
} from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
};

export default function Topbar() {
  const [location] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Cotización aprobada',
      message: 'La cotización para XYZ Corp ha sido aprobada',
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
    }
  ]);
  // Inicializamos el modo claro como activo por defecto
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Calcular el número de notificaciones no leídas
  const unreadCount = notifications.filter(n => !n.read).length;

  // Marcar notificación como leída
  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  // Marcar todas como leídas
  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  // Función para generar la ruta de migas de pan
  const generateBreadcrumbs = () => {
    if (location === '/') return [{ name: 'Dashboard', path: '/' }];
    
    // Dividir la ruta actual
    const paths = location.split('/').filter(Boolean);
    
    // Mapear los segmentos de ruta a nombres legibles
    const routeLabels: Record<string, string> = {
      'optimized-quote': 'Nueva Cotización',
      'manage-quotes': 'Gestionar Cotizaciones',
      'active-projects': 'Proyectos Activos',
      'clients': 'Clientes',
      'statistics': 'Estadísticas',
      'admin': 'Administración'
    };
    
    // Generar las migas de pan
    const breadcrumbs = [{ name: 'Dashboard', path: '/' }];
    let currentPath = '';
    
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const name = routeLabels[path] || path.charAt(0).toUpperCase() + path.slice(1);
      breadcrumbs.push({ name, path: currentPath });
    });
    
    return breadcrumbs;
  };
  
  const breadcrumbs = generateBreadcrumbs();

  // Toggle para modo oscuro
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // Implementación del cambio de tema
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  };

  return (
    <div className="topbar h-16 px-4 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between sticky top-0 z-20 w-full">
      {/* Breadcrumbs y título */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 mx-1 text-muted-foreground/50" />}
              {i < breadcrumbs.length - 1 ? (
                <Link href={crumb.path} className="hover:text-primary hover:underline">
                  {crumb.name}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{crumb.name}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Acciones y perfil */}
      <div className="flex items-center space-x-1.5">
        {/* Búsqueda global */}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Search className="h-4.5 w-4.5" />
        </Button>
        
        {/* Toggle modo oscuro/claro */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          {isDarkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </Button>
        
        {/* Calendario */}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Calendar className="h-4.5 w-4.5" />
        </Button>
        
        {/* Mensajes */}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <MessageSquare className="h-4.5 w-4.5" />
        </Button>
        
        {/* Ayuda */}
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4.5 w-4.5" />
        </Button>
        
        {/* Notificaciones */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative text-muted-foreground hover:text-foreground">
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-4 py-2">
              <DropdownMenuLabel className="font-normal">Notificaciones</DropdownMenuLabel>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  className="text-xs h-7 px-2"
                  onClick={markAllAsRead}
                >
                  Marcar todas como leídas
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id} 
                    className={cn(
                      "p-0 focus:bg-transparent", 
                      !notification.read && "bg-primary/5"
                    )}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <button 
                      className="w-full text-left px-4 py-2.5 flex items-start gap-3"
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        notification.type === 'success' && "bg-success/10 text-success",
                        notification.type === 'info' && "bg-info/10 text-info",
                        notification.type === 'warning' && "bg-warning/10 text-warning"
                      )}>
                        {notification.type === 'success' && <CheckCircle className="h-4 w-4" />}
                        {notification.type === 'info' && <MessageSquare className="h-4 w-4" />}
                        {notification.type === 'warning' && <Bell className="h-4 w-4" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <span className="text-xs text-muted-foreground">{notification.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {notification.message}
                        </p>
                      </div>
                      
                      {!notification.read && (
                        <span className="h-2 w-2 bg-primary rounded-full mt-2" />
                      )}
                    </button>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No hay notificaciones</p>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
              <Link href="/notifications" className="w-full">
                <div className="px-4 py-2 text-xs text-center text-muted-foreground hover:text-primary flex items-center justify-center">
                  Ver todas las notificaciones
                  <ChevronsRight className="h-3.5 w-3.5 ml-1" />
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Separador vertical */}
        <div className="h-6 w-px bg-border mx-1.5"></div>
        
        {/* Menu de usuario */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 pl-2 pr-3 gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">JS</AvatarFallback>
                <AvatarImage src="" />
              </Avatar>
              <span className="text-sm font-medium">Jane</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-4 py-3 flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-white">JS</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Jane Smith</p>
                <p className="text-xs text-muted-foreground">jane@example.com</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Configuración</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <div className="flex items-center gap-2 text-destructive">
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}