import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_NAV_FAVORITES } from '@/lib/app-navigation';
import type { useAppNavigation } from '@/hooks/use-app-navigation';

type Props = Pick<
  ReturnType<typeof useAppNavigation>,
  'options' | 'favorites' | 'setFavorites'
>;
export default function NavigationFavorites({
  options,
  favorites,
  setFavorites,
}: Props) {
  const [query, setQuery] = useState('');
  const paths = favorites.map((item) => item.href);
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  const visible = options.filter((item) =>
    normalize(`${item.areaTitle} ${item.title}`).includes(normalize(query)),
  );
  return (
    <Dialog onOpenChange={() => setQuery('')}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Editar favoritos"
          className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col gap-4">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle>Tus favoritos</DialogTitle>
          <DialogDescription>
            Elegí hasta cuatro accesos. Se guardan en este navegador para tu
            usuario.
          </DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
          <Input
            autoFocus
            aria-label="Buscar favorito"
            placeholder="Buscar herramienta o sala…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 shrink-0">
          <span>
            {paths.length === MAX_NAV_FAVORITES
              ? 'Quitá uno para agregar otro.'
              : 'Tus accesos más usados, a mano.'}
          </span>
          <span>
            {paths.length} / {MAX_NAV_FAVORITES}
          </span>
        </div>
        <div className="min-h-0 overflow-y-auto space-y-1">
          {visible.map((item) => {
            const checked = paths.includes(item.href);
            const Icon = item.icon;
            return (
              <label
                key={item.href}
                className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50 cursor-pointer has-[:disabled]:opacity-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && paths.length >= MAX_NAV_FAVORITES}
                  onChange={() =>
                    setFavorites(
                      checked
                        ? paths.filter((path) => path !== item.href)
                        : [...paths, item.href],
                    )
                  }
                  className="h-4 w-4 accent-rose-500 shrink-0"
                />
                <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="min-w-0 flex-1 text-sm break-words">
                  {item.title}
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {item.areaTitle}
                  </span>
                </span>
              </label>
            );
          })}
          {visible.length === 0 && (
            <p className="py-8 text-sm text-center text-slate-400">
              No hay accesos con ese nombre.
            </p>
          )}
        </div>
        <DialogClose asChild>
          <Button variant="outline" className="shrink-0 self-end">
            Listo
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
