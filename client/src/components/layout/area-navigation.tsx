import { Link, useLocation } from 'wouter';
import { MoreHorizontal, Star } from 'lucide-react';
import { useAppNavigation } from '@/hooks/use-app-navigation';
import { navigationPath, MAX_NAV_FAVORITES } from '@/lib/app-navigation';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AreaNavigation() {
  const nav = useAppNavigation();
  const [location] = useLocation();
  const { toast } = useToast();
  const area = nav.active?.area;
  if (!area || area.items.length < 2) return null;
  const primary = area.items.slice(0, 5),
    extra = area.items.slice(5);
  const activeExtra = extra.find((item) => item.href === nav.active?.item.href);
  const current =
    nav.options.find((item) => item.href === navigationPath(location)) ??
    nav.active?.item;
  const pinned =
    current && nav.favorites.some((item) => item.href === current.href);
  const pin = () => {
    if (!current) return;
    const paths = nav.favorites.map((item) => item.href);
    if (pinned) nav.setFavorites(paths.filter((path) => path !== current.href));
    else if (paths.length < MAX_NAV_FAVORITES)
      nav.setFavorites([...paths, current.href]);
    else
      toast({
        title: 'Tus cuatro favoritos están ocupados',
        description: 'Quitá uno desde Editar favoritos para fijar este acceso.',
      });
  };
  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 sm:px-6 flex flex-wrap items-center gap-x-5 gap-y-1 py-1">
      <span className="text-xs font-medium text-slate-400 hidden xl:block">
        {area.title}
      </span>
      <nav
        aria-label={`Herramientas de ${area.title}`}
        className="flex flex-wrap items-center gap-x-5 min-w-0 flex-1"
      >
        {primary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={
              nav.active?.item.href === item.href ? 'page' : undefined
            }
            className={cn(
              'inline-flex min-h-10 items-center border-b-2 px-0 py-2 text-xs transition-colors',
              nav.active?.item.href === item.href
                ? 'text-slate-900 font-medium border-rose-500'
                : 'text-slate-400 hover:text-slate-700 border-transparent',
            )}
          >
            {item.title}
          </Link>
        ))}
        {extra.length > 0 && (
          <Popover key={location}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'inline-flex min-h-10 items-center gap-1 border-b-2 py-2 text-xs',
                  activeExtra
                    ? 'border-rose-500 text-slate-900 font-medium'
                    : 'border-transparent text-slate-400 hover:text-slate-700',
                )}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                {activeExtra?.title ?? 'Más'}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 max-w-[calc(100vw-2rem)] p-1.5"
            >
              {extra.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    nav.active?.item.href === item.href ? 'page' : undefined
                  }
                  className={cn(
                    'flex items-center gap-2 rounded-lg p-2.5 text-xs hover:bg-slate-50',
                    nav.active?.item.href === item.href &&
                      'bg-slate-50 font-medium',
                  )}
                >
                  <item.icon className="h-4 w-4 text-slate-400 shrink-0" />
                  {item.title}
                </Link>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </nav>
      {!nav.provider && current && (
        <button
          onClick={pin}
          aria-label={`${pinned ? 'Quitar' : 'Fijar'} ${current.title} ${pinned ? 'de' : 'en'} favoritos`}
          aria-pressed={!!pinned}
          className="p-2 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50"
        >
          <Star
            className={cn(
              'h-3.5 w-3.5',
              pinned && 'fill-rose-500 text-rose-500',
            )}
          />
        </button>
      )}
    </div>
  );
}
