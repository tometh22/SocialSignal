import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

import {
  ChevronRight,
  LayoutDashboard,
  FileText,
  ListChecks,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  Plus,
  Zap,
  Building2,
  Clock,
} from "lucide-react";

type NavItem = {
  href: string;
  title: string;
  icon: any;
  badge?: string;
  status?: 'new';
  description?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
};

export default function ModernSidebar() {
  const { user, logoutMutation } = useAuth();
  const [currentPath] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Principal', 'Operaciones', 'Clientes & Análisis', 'Automatización']);

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionTitle)
        ? prev.filter(s => s !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  const getUserInitials = () => {
    if (!user) return "US";
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  };

  const navSections: NavSection[] = [
    {
      title: "Principal",
      items: [
        { href: "/", title: "Dashboard Ejecutivo", icon: LayoutDashboard, description: "Vista general del negocio" },
      ]
    },
    {
      title: "Operaciones",
      collapsible: true,
      items: [
        { href: "/optimized-quote", title: "Nueva Cotización", icon: Plus, status: 'new' as const, description: "Crear propuesta comercial" },
        { href: "/manage-quotes", title: "Gestionar Cotizaciones", icon: FileText, description: "Revisar propuestas" },
        { href: "/active-projects", title: "Proyectos Activos", icon: Briefcase, badge: "12", description: "Proyectos en curso" },
      ]
    },
    {
      title: "Clientes & Análisis",
      collapsible: true,
      items: [
        { href: "/clients", title: "Clientes", icon: Building2, description: "Base de clientes" },
        { href: "/statistics", title: "Análisis", icon: BarChart3, description: "Métricas y reportes" },
      ]
    },
    {
      title: "Automatización",
      items: [
        // { href: "/recurring-templates", title: "Always-On", icon: Zap, status: 'new' as const, description: "Servicios recurrentes" },
      ]
    },
    {
      title: "Sistema",
      items: [
        { href: "/admin", title: "Configuración", icon: Settings, description: "Panel administrativo" },
      ]
    }
  ];

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentPath === item.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative group",
          isActive
            ? "bg-blue-50 text-blue-700 font-medium shadow-sm border border-blue-200"
            : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-transparent",
          isCollapsed && "justify-center"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
          isActive ? "bg-blue-100" : "bg-gray-100 group-hover:bg-gray-200",
          isCollapsed ? "mr-0" : "mr-2.5"
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="truncate font-medium">{item.title}</span>
              <div className="flex items-center gap-2">
                {item.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
                {item.status === 'new' && (
                  <Badge variant="default" className="text-xs bg-blue-600">
                    Nuevo
                  </Badge>
                )}
              </div>
            </div>
            {item.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
            )}
          </div>
        )}
      </Link>
    );
  };

  const renderSection = (section: NavSection) => {
    const isExpanded = expandedSections.includes(section.title);

    return (
      <div key={section.title} className="px-3">
        {section.collapsible ? (
          <div
            className={cn(
              "flex items-center justify-between mb-2 px-2 cursor-pointer group",
              isCollapsed && "justify-center"
            )}
            onClick={() => !isCollapsed && toggleSection(section.title)}
          >
            <h3 className={cn(
              "text-xs font-semibold text-gray-500 tracking-wider uppercase",
              isCollapsed && "sr-only"
            )}>
              {section.title}
            </h3>
            {!isCollapsed && (
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-gray-400 transition-transform group-hover:text-gray-600",
                  isExpanded ? "transform rotate-180" : ""
                )}
              />
            )}
            {isCollapsed && (
              <div className="h-0.5 w-4 rounded-full bg-gray-300"></div>
            )}
          </div>
        ) : (
          <div className={cn(
            "flex items-center mb-2 px-2",
            isCollapsed && "justify-center"
          )}>
            <h3 className={cn(
              "text-xs font-semibold text-gray-500 tracking-wider uppercase",
              isCollapsed && "sr-only"
            )}>
              {section.title}
            </h3>
            {isCollapsed && (
              <div className="h-0.5 w-4 rounded-full bg-gray-300"></div>
            )}
          </div>
        )}

        {(!section.collapsible || isExpanded || isCollapsed) && (
          <nav className="space-y-1.5">
            {section.items.map((item) => renderNavLink(item))}
          </nav>
        )}
      </div>
    );
  };

  return (
    <motion.div
      className={cn(
        "fixed top-0 bottom-0 left-0 z-50 h-screen flex flex-col bg-white border-r border-gray-200 shadow-xl md:shadow-lg md:relative md:z-0",
        isCollapsed ? "w-[72px]" : "w-[260px]"
      )}
      initial={false}
      animate={{
        width: isCollapsed ? 72 : 260,
        transition: { duration: 0.2 }
      }}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between py-4 px-3 border-b border-gray-200 bg-white",
        isCollapsed && "justify-center"
      )}>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-gray-900 tracking-tight">
                Mind
              </span>
              <span className="text-xs text-gray-500 font-medium">
                Epical Digital
              </span>
            </div>
          )}
        </Link>

        {!isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="h-7 w-7 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 bg-gray-50/30">
        {navSections.map(renderSection)}
      </div>

      {/* User Section */}
      <div className="border-t border-gray-200 p-4 bg-white">
        {user && (
          <div className={cn(
            "flex items-center gap-3",
            isCollapsed && "justify-center"
          )}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">Administrador</p>
              </div>
            )}
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                className="h-8 w-8 text-gray-400 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Actividad Reciente - Solo cuando no está colapsado */}
        {!isCollapsed && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Actividad Reciente
              </span>
            </div>
            <div className="text-xs text-gray-400">
              <p>Última sesión: Hace 2 min</p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(false)}
              className="h-8 w-8 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}