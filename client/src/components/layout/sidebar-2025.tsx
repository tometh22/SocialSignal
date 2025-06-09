import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Zap,
  Building2,
  Clock,
  Search,
  Bell,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Calendar,
  FolderOpen,
} from "lucide-react";

type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string | number;
  status?: 'new' | 'updated' | 'hot';
  description?: string;
  shortcut?: string;
  color?: string;
};

type NavGroup = {
  id: string;
  title: string;
  items: NavItem[];
  priority?: 'high' | 'medium' | 'low';
};

export default function Sidebar2025() {
  const { user, logoutMutation } = useAuth();
  const [currentPath] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  // Navegación organizada por frecuencia de uso y flujo de trabajo
  const navGroups: NavGroup[] = [
    {
      id: "primary",
      title: "Principal",
      priority: "high",
      items: [
        { 
          href: "/", 
          title: "Dashboard", 
          icon: LayoutDashboard, 
          description: "Vista general",
          shortcut: "⌘1",
          color: "blue"
        },
      ]
    },
    {
      id: "workflow",
      title: "Flujo de Trabajo",
      priority: "high",
      items: [
        { 
          href: "/optimized-quote", 
          title: "Nueva Cotización", 
          icon: Plus, 
          status: 'hot' as const, 
          description: "Crear propuesta",
          shortcut: "⌘N",
          color: "green"
        },
        { 
          href: "/active-projects", 
          title: "Proyectos", 
          icon: FolderOpen, 
          badge: 12, 
          description: "En curso",
          shortcut: "⌘P",
          color: "purple"
        },
        { 
          href: "/manage-quotes", 
          title: "Cotizaciones", 
          icon: FileText, 
          description: "Gestionar propuestas",
          color: "orange"
        },
      ]
    },
    {
      id: "clients",
      title: "Clientes",
      priority: "medium",
      items: [
        { 
          href: "/clients", 
          title: "Base de Clientes", 
          icon: Building2, 
          description: "Gestión de clientes",
          color: "cyan"
        },
        { 
          href: "/statistics", 
          title: "Análisis", 
          icon: TrendingUp, 
          description: "Métricas y KPIs",
          color: "pink"
        },
      ]
    },
    {
      id: "automation",
      title: "Automatización",
      priority: "medium",
      items: [
        { 
          href: "/recurring-templates", 
          title: "Always-On", 
          icon: Zap, 
          status: 'new' as const, 
          description: "Servicios recurrentes",
          color: "yellow"
        },
      ]
    },
    {
      id: "system",
      title: "Sistema",
      priority: "low",
      items: [
        { 
          href: "/admin", 
          title: "Configuración", 
          icon: Settings, 
          description: "Panel admin",
          color: "gray"
        },
      ]
    }
  ];

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default" className="text-xs bg-blue-500 text-white border-0">Nuevo</Badge>;
      case 'updated':
        return <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-0">Actualizado</Badge>;
      case 'hot':
        return <Badge variant="destructive" className="text-xs bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 animate-pulse">Hot</Badge>;
      default:
        return null;
    }
  };

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors = {
      blue: isActive ? "bg-blue-50 text-blue-700 border-blue-200" : "hover:bg-blue-50/50",
      green: isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "hover:bg-emerald-50/50",
      purple: isActive ? "bg-purple-50 text-purple-700 border-purple-200" : "hover:bg-purple-50/50",
      orange: isActive ? "bg-orange-50 text-orange-700 border-orange-200" : "hover:bg-orange-50/50",
      cyan: isActive ? "bg-cyan-50 text-cyan-700 border-cyan-200" : "hover:bg-cyan-50/50",
      pink: isActive ? "bg-pink-50 text-pink-700 border-pink-200" : "hover:bg-pink-50/50",
      yellow: isActive ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "hover:bg-yellow-50/50",
      gray: isActive ? "bg-gray-50 text-gray-700 border-gray-200" : "hover:bg-gray-50/50",
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  const getIconColorClasses = (color: string, isActive: boolean) => {
    if (isActive) {
      const activeColors = {
        blue: "bg-blue-100 text-blue-600",
        green: "bg-emerald-100 text-emerald-600",
        purple: "bg-purple-100 text-purple-600",
        orange: "bg-orange-100 text-orange-600",
        cyan: "bg-cyan-100 text-cyan-600",
        pink: "bg-pink-100 text-pink-600",
        yellow: "bg-yellow-100 text-yellow-600",
        gray: "bg-gray-100 text-gray-600",
      };
      return activeColors[color as keyof typeof activeColors] || activeColors.gray;
    }
    return "bg-gray-100 text-gray-600 group-hover:bg-gray-200";
  };

  const renderNavItem = (item: NavItem, groupPriority: string = 'medium') => {
    const Icon = item.icon;
    const isActive = currentPath === item.href;
    const isHovered = hoveredItem === item.href;
    
    return (
      <motion.div
        key={item.href}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Link
          href={item.href}
          className={cn(
            "group flex items-center px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative overflow-hidden",
            "border border-transparent backdrop-blur-sm",
            isActive
              ? cn("font-medium shadow-sm", item.color ? getColorClasses(item.color, true) : "bg-blue-50 text-blue-700 border-blue-200")
              : cn("text-gray-700 hover:text-gray-900", item.color ? getColorClasses(item.color, false) : "hover:bg-gray-50"),
            isCollapsed && "justify-center",
            groupPriority === 'high' && "font-medium"
          )}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          {/* Efecto de brillo sutil */}
          {isHovered && !isActive && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
          )}
          
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 flex-shrink-0",
            item.color ? getIconColorClasses(item.color, isActive) : (isActive ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"),
            isCollapsed ? "mr-0" : "mr-3"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.title}</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-gray-200 text-gray-700">
                        {item.badge}
                      </Badge>
                    )}
                    {typeof item.badge === 'string' && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {item.badge}
                      </Badge>
                    )}
                    {item.status && getStatusBadge(item.status)}
                  </div>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate leading-none">
                    {item.description}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Keyboard shortcut hint */}
          {!isCollapsed && item.shortcut && isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {item.shortcut}
              </span>
            </motion.div>
          )}
        </Link>
      </motion.div>
    );
  };

  const renderNavGroup = (group: NavGroup) => {
    const priorityColors = {
      high: "text-gray-900",
      medium: "text-gray-600", 
      low: "text-gray-500"
    };

    return (
      <motion.div
        key={group.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-1"
      >
        {!isCollapsed && (
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className={cn(
              "text-xs font-semibold tracking-wider uppercase",
              priorityColors[group.priority || 'medium']
            )}>
              {group.title}
            </h3>
            {group.priority === 'high' && (
              <Sparkles className="h-3 w-3 text-yellow-500" />
            )}
          </div>
        )}
        
        <div className="space-y-1">
          {group.items.map((item) => renderNavItem(item, group.priority))}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      className={cn(
        "fixed top-0 bottom-0 left-0 z-50 h-screen flex flex-col",
        "bg-white/95 backdrop-blur-xl border-r border-gray-200/80 shadow-2xl",
        "md:relative md:z-0",
        isCollapsed ? "w-[80px]" : "w-[280px]"
      )}
      initial={false}
      animate={{
        width: isCollapsed ? 80 : 280,
        transition: { duration: 0.3, ease: "easeInOut" }
      }}
    >
      {/* Header con glassmorphism */}
      <div className={cn(
        "flex items-center justify-between p-4 border-b border-gray-200/50",
        "bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm",
        isCollapsed && "justify-center"
      )}>
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div 
            className="relative w-10 h-10 rounded-2xl overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="relative w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-lg tracking-tight">M</span>
            </div>
          </motion.div>
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <span className="text-lg font-bold text-gray-900 tracking-tight">
                  Mind
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  Epical Digital
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(true)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navegación principal */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navGroups.map(renderNavGroup)}
      </div>

      {/* Footer con información del usuario */}
      <div className={cn(
        "border-t border-gray-200/50 p-4",
        "bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm"
      )}>
        {user && (
          <div className={cn(
            "flex items-center gap-3 transition-all duration-200",
            isCollapsed && "justify-center"
          )}>
            <Avatar className="h-9 w-9 ring-2 ring-gray-200">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Administrador</span>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => logoutMutation.mutate()}
                    className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Botón de expansión cuando está colapsada */}
        <AnimatePresence>
          {isCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="mt-3 flex justify-center"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(false)}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default Sidebar2025;