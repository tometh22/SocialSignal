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
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Calendar,
  FolderOpen,
  Home,
  Edit3,
  Target,
} from "lucide-react";

type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string | number;
  isCollapsible?: boolean;
  children?: NavItem[];
};

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
  isCollapsible?: boolean;
};

export default function SidebarAwesome() {
  const { user, logoutMutation } = useAuth();
  const [currentPath] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['ui-base', 'account-pages']);

  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  const toggleExpanded = (itemTitle: string) => {
    setExpandedItems(prev => 
      prev.includes(itemTitle) 
        ? prev.filter(item => item !== itemTitle)
        : [...prev, itemTitle]
    );
  };

  // Navegación inspirada en el diseño de referencia
  const navSections: NavSection[] = [
    {
      id: "main",
      title: "",
      items: [
        { 
          href: "/", 
          title: "Dashboard", 
          icon: LayoutDashboard,
        },
      ]
    },
    {
      id: "workspace",
      title: "",
      items: [
        {
          href: "#",
          title: "UI Base",
          icon: Target,
          isCollapsible: true,
          children: [
            { href: "/optimized-quote", title: "Nueva Cotización", icon: Plus },
            { href: "/manage-quotes", title: "Cotizaciones", icon: FileText },
            { href: "/active-projects", title: "Proyectos", icon: FolderOpen, badge: 12 },
          ]
        },
        {
          href: "#",
          title: "UI Components",
          icon: Edit3,
          isCollapsible: true,
          children: [
            { href: "/clients", title: "Clientes", icon: Building2 },
            { href: "/statistics", title: "Análisis", icon: TrendingUp },
          ]
        },
        { 
          href: "/forms", 
          title: "Forms", 
          icon: FileText,
        },
        { 
          href: "/tables", 
          title: "Tables", 
          icon: BarChart3,
        },
        {
          href: "#",
          title: "Account Pages",
          icon: Users,
          isCollapsible: true,
          children: [
            { href: "/recurring-templates", title: "Always-On", icon: Zap },
            { href: "/admin", title: "Configuración", icon: Settings },
          ]
        },
        { 
          href: "/other-pages", 
          title: "Other Pages", 
          icon: Home,
        },
        { 
          href: "/documentation", 
          title: "Documentation", 
          icon: FileText,
        },
        { 
          href: "/free-download", 
          title: "Free Download", 
          icon: Sparkles,
        },
      ]
    }
  ];

  const renderNavItem = (item: NavItem, level: number = 0) => {
    const Icon = item.icon;
    const isActive = currentPath === item.href;
    const isExpanded = expandedItems.includes(item.title);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.title}>
        <div
          className={cn(
            "group flex items-center justify-between px-4 py-2.5 text-sm transition-all duration-200 cursor-pointer",
            level === 0 ? "mx-2 rounded-lg" : "ml-8 mr-2 rounded-md",
            isActive
              ? "bg-blue-600 text-white font-medium shadow-lg"
              : "text-gray-300 hover:text-white hover:bg-gray-700/50",
            hasChildren && !isCollapsed && "hover:bg-gray-700/30"
          )}
          onClick={() => {
            if (hasChildren && item.isCollapsible) {
              toggleExpanded(item.title);
            }
          }}
        >
          <Link
            href={item.href}
            className="flex items-center flex-1 min-w-0"
            onClick={(e) => {
              if (hasChildren && item.isCollapsible) {
                e.preventDefault();
              }
            }}
          >
            <div className={cn(
              "flex items-center justify-center w-6 h-6 flex-shrink-0",
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
                  className="flex items-center justify-between flex-1 min-w-0"
                >
                  <span className="truncate">{item.title}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          
          <div className="flex items-center gap-2">
            {!isCollapsed && typeof item.badge === 'number' && item.badge > 0 && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-gray-600 text-gray-200 border-0">
                {item.badge}
              </Badge>
            )}
            
            {!isCollapsed && hasChildren && item.isCollapsible && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-gray-400 transition-transform duration-200",
                  isExpanded ? "transform rotate-180" : ""
                )}
              />
            )}
          </div>
        </div>

        {/* Children */}
        <AnimatePresence>
          {hasChildren && (!item.isCollapsible || isExpanded) && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="py-1">
                {item.children?.map((child) => renderNavItem(child, level + 1))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderSection = (section: NavSection) => {
    return (
      <div key={section.id} className="space-y-1">
        {section.title && !isCollapsed && (
          <div className="px-6 py-2">
            <h3 className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
              {section.title}
            </h3>
          </div>
        )}
        
        <div className="space-y-1">
          {section.items.map((item) => renderNavItem(item))}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className={cn(
        "fixed top-0 bottom-0 left-0 z-50 h-screen flex flex-col",
        "bg-gray-800 shadow-2xl",
        "md:relative md:z-0",
        isCollapsed ? "w-[70px]" : "w-[200px]"
      )}
      initial={false}
      animate={{
        width: isCollapsed ? 70 : 200,
        transition: { duration: 0.3, ease: "easeInOut" }
      }}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center p-4 border-b border-gray-700",
        isCollapsed && "justify-center"
      )}>
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div 
            className="relative w-8 h-8 rounded-lg overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700" />
            <div className="relative w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-sm tracking-tight">A</span>
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
                <span className="text-sm font-bold text-white tracking-tight">
                  AWESOME
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  KIT
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navegación principal */}
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {navSections.map(renderSection)}
      </div>

      {/* Footer con información del usuario */}
      <div className="border-t border-gray-700 p-4">
        {user && (
          <div className={cn(
            "flex items-center gap-3 transition-all duration-200",
            isCollapsed && "justify-center"
          )}>
            <Avatar className="h-8 w-8 ring-2 ring-gray-600">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-xs font-medium">
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
                  <p className="text-xs font-medium text-gray-200 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-400">Admin</p>
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
                    className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-all duration-200"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Botón de colapso */}
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 w-7 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-all duration-200"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}