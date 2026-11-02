import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppNavigation } from '@/hooks/use-app-navigation';
import { authFetch } from '@/lib/queryClient';
import { navigationPath } from '@/lib/app-navigation';
import { cn } from '@/lib/utils';
import BrandMark from './brand-mark';
import NavigationFavorites from './navigation-favorites';

interface SidebarFixedProps {
  mobileMode?: boolean;
  onNavigate?: () => void;
}
export default function SidebarFixed({
  mobileMode = false,
  onNavigate,
}: SidebarFixedProps = {}) {
  const nav = useAppNavigation();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const isCollapsed = !mobileMode && collapsed;
  const canSeeCrm = nav.areas.some((area) =>
    area.items.some((item) => item.href === '/crm'),
  );
  const { data: crm } = useQuery<{ overdueReminders?: number }>({
    queryKey: ['/api/crm/stats', 'navigation'],
    enabled: canSeeCrm,
    staleTime: 60000,
    refetchInterval: 60000,
    queryFn: async () => {
      const response = await authFetch('/api/crm/stats');
      if (!response.ok) throw new Error('Error al cargar recordatorios');
      return response.json();
    },
  });
  const pendingStatus = Array.isArray(nav.rooms)
    ? nav.rooms.reduce((sum, room) => sum + (room.pendingCount || 0), 0)
    : 0;
  const initials =
    `${nav.user?.firstName?.[0] ?? ''}${nav.user?.lastName?.[0] ?? ''}` || 'US';
  const link = (
    href: string,
    title: string,
    Icon: LucideIcon,
    active: boolean,
    badge = 0,
    favorite = false,
  ) => (
    <Tooltip key={href}>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          aria-label={isCollapsed ? title : undefined}
          className={cn(
            'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60',
            favorite ? 'min-h-10 text-white/50' : 'min-h-11 text-white/[0.68]',
            active
              ? 'bg-white/10 !text-white'
              : 'hover:bg-white/[0.06] hover:text-white',
            isCollapsed && 'justify-center px-2',
          )}
        >
          {active && (
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-rose-500" />
          )}
          <Icon
            className={cn(
              'shrink-0',
              favorite ? 'h-3.5 w-3.5' : 'h-[17px] w-[17px]',
            )}
          />
          {!isCollapsed && (
            <>
              <span className="flex-1 min-w-0 break-words leading-5">
                {title}
              </span>
              {badge > 0 && (
                <span
                  className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] tabular-nums text-white/[0.65]"
                  aria-label={`${badge} pendientes`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </>
          )}
        </Link>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right">
          {title}
          {badge > 0 ? ` · ${badge} pendientes` : ''}
        </TooltipContent>
      )}
    </Tooltip>
  );
  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="Navegación principal"
        className={cn(
          'flex shrink-0 flex-col overflow-hidden bg-[#0e1118] text-white h-full',
          mobileMode
            ? 'w-full'
            : 'border-r border-white/[0.07] transition-[width] duration-200',
          !mobileMode && (isCollapsed ? 'w-[72px]' : 'w-[232px]'),
        )}
      >
        <div
          className={cn(
            'flex h-[72px] shrink-0 items-center border-b border-white/[0.07] px-3',
            isCollapsed ? 'justify-center' : 'justify-between gap-2',
          )}
        >
          {isCollapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Expandir navegación"
              className="rounded-lg focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <BrandMark compact showWordmark={false} />
            </button>
          ) : (
            <>
              <BrandMark compact />
              {!mobileMode && (
                <button
                  onClick={() => setCollapsed(true)}
                  aria-label="Contraer navegación"
                  className="p-1.5 rounded text-white/40 hover:bg-white/10 hover:text-white shrink-0"
                >
                  <ChevronRight className="h-3 w-3 rotate-180" />
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-5">
          {!isCollapsed && !nav.provider && (
            <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.13em] text-white/30">
              Áreas
            </p>
          )}
          <nav className="space-y-1" aria-label="Áreas de Mind">
            {nav.areas.map((area) =>
              link(
                area.items[0].href,
                area.title,
                area.icon,
                nav.active?.area.id === area.id,
                area.id === 'commercial'
                  ? (crm?.overdueReminders ?? 0)
                  : area.id === 'status'
                    ? pendingStatus
                    : 0,
              ),
            )}
          </nav>
          {!nav.provider && (
            <section className="mt-6" aria-label="Favoritos">
              {!isCollapsed && (
                <div className="flex items-center justify-between px-3 mb-1">
                  <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/30">
                    Favoritos
                  </p>
                  <NavigationFavorites
                    options={nav.options}
                    favorites={nav.favorites}
                    setFavorites={nav.setFavorites}
                  />
                </div>
              )}
              <div className="space-y-0.5">
                {nav.favorites.map((item) =>
                  link(
                    item.href,
                    item.title,
                    item.icon,
                    navigationPath(location) === item.href,
                    0,
                    true,
                  ),
                )}
              </div>
              {!isCollapsed && nav.favorites.length === 0 && (
                <p className="px-3 pt-2 text-xs text-white/30">
                  Fijá tus accesos más usados.
                </p>
              )}
            </section>
          )}
        </div>
        <div className="shrink-0 border-t border-white/[0.07] px-4 py-4 flex items-center gap-2.5">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-white/10 text-[10px] text-white/75">
              {initials}
            </AvatarFallback>
            {nav.user?.avatar && <AvatarImage src={nav.user.avatar} />}
          </Avatar>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="text-[11px] text-white/70 break-words">
                {nav.user
                  ? `${nav.user.firstName} ${nav.user.lastName}`
                  : 'Mind'}
              </p>
              <p className="text-[9px] mt-0.5 text-white/30 uppercase tracking-wider">
                Powered by Epical
              </p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
