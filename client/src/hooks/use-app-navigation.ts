import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  reviewApi,
  reviewKeys,
  type ReviewRoomSummary,
} from '@/lib/review-api';
import {
  activeNavigation,
  favoritesStorageKey,
  favoriteItems,
  MAX_NAV_FAVORITES,
  navigationAreas,
  parseFavoritePaths,
} from '@/lib/app-navigation';

const memory = new Map<string, string>();
const CHANGE = 'mind-navigation-favorites';
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key) memory.delete(event.key);
    else memory.clear();
    callback();
  };
  window.addEventListener('storage', storage);
  window.addEventListener(CHANGE, callback);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(CHANGE, callback);
  };
}
function snapshot(key: string | null) {
  if (!key) return null;
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function useAppNavigation() {
  const { user } = useAuth();
  const [location] = useLocation();
  const areas = useMemo(() => navigationAreas(user), [user]);
  const active = activeNavigation(areas, location);
  const provider = user?.role === 'external_provider';
  const canSeeRooms = areas.some((area) =>
    area.items.some((item) => item.href === '/review'),
  );
  const { data: rooms = [] } = useQuery<ReviewRoomSummary[]>({
    queryKey: [...reviewKeys.list(), user?.id],
    queryFn: reviewApi.listRooms,
    enabled: canSeeRooms,
    staleTime: 60000,
  });
  const options = useMemo(() => {
    const items = areas.flatMap((area) =>
      area.items.map((item) => ({ ...item, areaTitle: area.title })),
    );
    if (canSeeRooms && !provider && Array.isArray(rooms))
      items.push(
        ...rooms.map((room) => ({
          href: `/review/${room.id}`,
          title: room.name,
          description: 'Sala de Status',
          icon: ClipboardList,
          areaTitle: 'Status',
        })),
      );
    return items;
  }, [areas, rooms, provider, canSeeRooms]);
  const defaults = ['/tasks/my-tasks', '/review'].filter((href) =>
    options.some((item) => item.href === href),
  );
  const key = user?.id ? favoritesStorageKey(user.id) : null;
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => null,
  );
  const paths = parseFavoritePaths(raw, defaults);
  const favorites = favoriteItems(options, paths);
  const setFavorites = (next: string[]) => {
    if (!key) return;
    const value = JSON.stringify(
      [...new Set(next)]
        .filter((path) => options.some((option) => option.href === path))
        .slice(0, MAX_NAV_FAVORITES),
    );
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep preferences usable for this session when storage is unavailable. */
    }
    window.dispatchEvent(new Event(CHANGE));
  };
  return {
    areas,
    active,
    options,
    favorites,
    setFavorites,
    provider,
    rooms,
    user,
  };
}
