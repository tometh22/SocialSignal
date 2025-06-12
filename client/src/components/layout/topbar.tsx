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
  AlertTriangle,
  Bell,
  CheckCircle, 
  ChevronsRight,
  Search,
  Settings,
  LogOut,
  ChevronRight,
  ClockIcon,
  BarChart,
  FileWarning,
  MessageSquare,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

// Importación de los componentes de funcionalidades
import { GlobalSearch } from "@/components/features/global-search";
import { MessagesPopup } from "@/components/features/messages-popup";
import { HelpPopup } from "@/components/features/help-popup";

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
  projectId?: number;
};

export default function Topbar() {
  const [location, navigate] = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, logoutMutation, isLoading } = useAuth();
  
  // Obtener iniciales del nombre de usuario
  const getUserInitials = () => {
    if (!user) return "--";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  };
  
  // Manejar el cierre de sesión
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Notificaciones relacionadas con riesgos de proyectos
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Proyecto en riesgo',
      message: 'Warner Bros. - 80% del presupuesto consumido',
      time: 'hace 2 días',
      read: false,
      type: 'warning',
      projectId: 1
    },
    {
      id: '2',
      title: 'Fecha de entrega próxima',
      message: 'Proyecto Warner - 5 días para la entrega',
      time: 'hace 1 día',
      read: false,
      type: 'warning',
      projectId: 1
    },
    {
      id: '3',
      title: 'Horas excedidas',
      message: 'Proyecto uberchil - 110% de horas planeadas',
      time: 'hace 3 horas',
      read: false,
      type: 'warning',
      projectId: 3
    }
  ]);

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
      'admin': 'Administración',
      'project-summary': 'Resumen de Proyecto',
      'client-summary': 'Resumen de Cliente',
      'time-entries': 'Registro de Horas',
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

  // Navegar al proyecto desde una notificación
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.projectId) {
      window.location.href = `/project-summary/${notification.projectId}`;
    }
  };

  return (
    <>
      <div className="topbar h-12 px-4 border-b border-slate-200/60 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 flex items-center justify-between sticky top-0 z-20 w-full shadow-sm">
        {/* Breadcrumbs minimalistas */}
        <div className="flex items-center">
          <div className="flex items-center text-sm text-slate-600">
            {breadcrumbs.map((crumb, i) => (
              <div key={i} className="flex items-center">
                {i > 0 && <ChevronRight className="h-3 w-3 mx-1.5 text-slate-400" />}
                {i < breadcrumbs.length - 1 ? (
                  <Link href={crumb.path} className="hover:text-slate-900 transition-colors font-medium">
                    {crumb.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-900">{crumb.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Acciones compactas */}
        <div className="flex items-center space-x-1">
          {/* Búsqueda global */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          
          {/* Ayuda */}
          <HelpPopup />
          
          {/* Notificaciones */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 relative text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 shadow-lg border-slate-200">
              <div className="flex items-center justify-between px-4 py-2.5">
                <DropdownMenuLabel className="font-medium text-slate-900">Alertas de Proyectos</DropdownMenuLabel>
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    className="text-xs h-6 px-2 text-slate-600 hover:text-slate-900"
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
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                          notification.type === 'success' && "bg-success/10 text-success",
                          notification.type === 'info' && "bg-info/10 text-info",
                          notification.type === 'warning' && "bg-amber-100 text-amber-700"
                        )}>
                          {notification.type === 'success' && <CheckCircle className="h-4 w-4" />}
                          {notification.type === 'info' && <MessageSquare className="h-4 w-4" />}
                          {notification.type === 'warning' && (
                            notification.message.includes('presupuesto') ? <BarChart className="h-4 w-4" /> :
                            notification.message.includes('fecha') ? <ClockIcon className="h-4 w-4" /> :
                            notification.message.includes('horas') ? <AlertTriangle className="h-4 w-4" /> :
                            <FileWarning className="h-4 w-4" />
                          )}
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
                    <p className="text-sm text-muted-foreground">No hay alertas de proyectos</p>
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
                <Link href="/notifications" className="w-full">
                  <div className="px-4 py-2 text-xs text-center text-muted-foreground hover:text-primary flex items-center justify-center">
                    Ver todas las alertas
                    <ChevronsRight className="h-3.5 w-3.5 ml-1" />
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Separador vertical */}
          <div className="h-4 w-px bg-slate-200 mx-2"></div>
          
          {/* Menu de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 pl-2 pr-3 gap-2 hover:bg-slate-100 rounded-lg">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                      {user?.avatar && <AvatarImage src={user.avatar} />}
                    </Avatar>
                    <span className="text-sm font-medium text-slate-900">
                      {user ? user.firstName : 'Usuario'}
                    </span>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user && (
                <>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-white">
                        {getUserInitials()}
                      </AvatarFallback>
                      {user.avatar && <AvatarImage src={user.avatar} />}
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
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
                  <DropdownMenuItem onSelect={handleLogout}>
                    <div className="flex items-center gap-2 text-destructive">
                      <LogOut className="h-4 w-4" />
                      <span>
                        {logoutMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Cerrando sesión...</span>
                          </div>
                        ) : (
                          "Cerrar sesión"
                        )}
                      </span>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Componente de búsqueda global */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}