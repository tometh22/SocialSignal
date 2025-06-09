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
  Star,
  Activity,
  Database,
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

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
  canPin?: boolean;
};

export default function SidebarImproved() {
  const { user, logoutMutation } = useAuth();
  const [currentPath] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pinnedItems, setPinnedItems] = useState<string[]>([]);

  const getUserInitials = () => {
    if (!user) return "M";
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`;
  };

  const getUserName = () => {
    if (!user) return "Mind";
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Usuario";
  };

  // Navegación estructurada similar a la imagen
  const navSections: NavSection[] = [
    {
      id: "principal",
      title: "PRINCIPAL",
      items: [
        { 
          href: "/", 
          title: "Dashboard", 
          icon: LayoutDashboard, 
          description: "Vista general",
          color: "blue"
        },
      ]
    },
    {
      id: "flujo-trabajo",
      title: "FLUJO DE TRABAJO",
      items: [
        { 
          href: "/optimized-quote", 
          title: "Nueva Cotización", 
          icon: Plus, 
          status: 'hot' as const, 
          description: "Crear propuesta",
          color: "red"
        },
        { 
          href: "/active-projects", 
          title: "Proyectos", 
          icon: FolderOpen, 
          badge: 12, 
          description: "En curso",
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
      id: "clientes",
      title: "CLIENTES",
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

  ];

  const renderNavItem = (item: NavItem) => {
    const isActive = currentPath === item.href;
    
    const statusColors = {
      hot: "bg-red-500 text-white text-xs px-2 py-1 rounded-md font-medium",
      new: "bg-green-500 text-white text-xs px-2 py-1 rounded-md font-medium", 
      updated: "bg-blue-500 text-white text-xs px-2 py-1 rounded-md font-medium"
    };

    return (
      <motion.div
        key={item.href}
        whileHover={{ x: 1 }}
        whileTap={{ scale: 0.98 }}
      >
        <Link href={item.href}>
          <div className={cn(
            "group flex items-center gap-3 px-4 py-3 mx-3 rounded-xl transition-all duration-200 relative",
            "hover:bg-gray-50 cursor-pointer border-l-4 border-transparent",
            isActive 
              ? "bg-blue-50 border-l-blue-500 text-blue-900 shadow-sm" 
              : "text-gray-700 hover:text-gray-900 hover:border-l-gray-300"
          )}>
            <div className={cn(
              "flex items-center justify-center w-5 h-5 transition-colors",
              isActive ? "text-blue-600" : "text-gray-500"
            )}>
              <item.icon className="w-5 h-5" />
            </div>
            
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className={cn(
                        "font-medium text-sm block",
                        isActive ? "text-blue-900" : "text-gray-800"
                      )}>
                        {item.title}
                      </span>
                      {item.description && (
                        <span className="text-xs text-gray-500 block mt-0.5">
                          {item.description}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-2">
                      {item.status && (
                        <span className={statusColors[item.status]}>
                          {item.status === 'hot' ? 'Hot' : item.status === 'new' ? 'New' : 'Updated'}
                        </span>
                      )}
                      
                      {item.badge && (
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-200 text-gray-700 font-medium">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Link>
      </motion.div>
    );
  };

  const renderNavSection = (section: NavSection) => {
    return (
      <motion.div
        key={section.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-2"
      >
        {!isCollapsed && (
          <div className="flex items-center justify-between px-5 py-2 mt-6 first:mt-0">
            <h3 className="text-xs font-bold tracking-wider text-gray-600 uppercase">
              {section.title}
            </h3>
            {section.id === "principal" && (
              <Sparkles className="h-3 w-3 text-yellow-500" />
            )}
          </div>
        )}
        
        <div className="space-y-1">
          {section.items.map((item) => renderNavItem(item))}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      className={cn(
        "fixed top-0 bottom-0 left-0 z-50 h-screen flex flex-col",
        "bg-white border-r border-gray-200 shadow-lg",
        "md:relative md:z-0",
        isCollapsed ? "w-[72px]" : "w-[280px]"
      )}
      initial={false}
      animate={{
        width: isCollapsed ? 72 : 280,
        transition: { duration: 0.3, ease: "easeInOut" }
      }}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-4 border-b border-gray-200",
        isCollapsed && "justify-center"
      )}>
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div 
            className="relative w-9 h-9 rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600" />
            <div className="relative w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
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
                <span className="text-lg font-bold text-gray-900">
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
                className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 space-y-2">
        {navSections.map(renderNavSection)}
      </div>

      {/* User Footer */}
      <div className={cn(
        "border-t border-gray-200 p-4",
        isCollapsed && "px-2"
      )}>
        {user && (
          <div className={cn(
            "flex items-center gap-3 transition-all duration-200",
            isCollapsed && "justify-center"
          )}>
            <Avatar className="h-9 w-9 ring-2 ring-gray-200">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white text-sm font-medium">
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
                    {getUserName()}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Administrador</span>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
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
                    className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Expand button when collapsed */}
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
                className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
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