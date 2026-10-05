import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight, Bell, BellOff, Check, CheckCheck, ChevronDown, Circle, ClipboardList,
  Inbox, Mail, MessageCircle, Monitor, Settings2, Sparkles, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { authFetch, apiRequest } from "@/lib/queryClient";
import { disableWebPush, enableWebPush } from "@/lib/notification-push";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type ProductNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: number | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};
type Category = "mind" | "daily" | "tasks" | "crm" | "team";
type CategoryChannelPreferences = Record<string, { desktop?: boolean; email?: boolean }>;
type NotificationPreferences = {
  desktopEnabled: boolean;
  emailEnabled: boolean;
  discreetMode?: boolean;
  categoryPreferences?: CategoryChannelPreferences;
};
type NotificationPage = { items: ProductNotification[]; unreadCount: number; hasMore: boolean; nextCursor: number | null };
type NotificationGroup = { key: string; items: ProductNotification[]; latest: ProductNotification; unreadIds: number[] };

const categories: { key: Category; label: string; detail: string }[] = [
  { key: "mind", label: "Conversaciones en Mind", detail: "Respuestas en los espacios que seguís" },
  { key: "daily", label: "Dailies", detail: "Cuando alguien completa una daily en tus espacios" },
  { key: "tasks", label: "Tareas", detail: "Asignaciones y nuevas respuestas" },
  { key: "crm", label: "CRM", detail: "Recordatorios asignados a vos" },
  { key: "team", label: "Equipo", detail: "Solicitudes y decisiones de ausencias" },
];

function notificationHref(item: ProductNotification) {
  if (item.actionUrl?.startsWith("/") && !item.actionUrl.startsWith("//")) return item.actionUrl;
  if (item.type.startsWith("mind_")) return item.entityId ? `/review/${item.entityId}` : "/review";
  if (item.type.startsWith("task_")) return "/tasks/my-tasks";
  if (item.type.startsWith("crm_")) return item.entityId ? `/crm/${item.entityId}` : "/crm";
  if (item.type.startsWith("absence")) return "/absences";
  return "/";
}

function typeStyle(type: string) {
  if (type.startsWith("mind_")) return { icon: MessageCircle, iconClass: "bg-violet-100 text-violet-700", label: "Mind" };
  if (type.startsWith("task_")) return { icon: ClipboardList, iconClass: "bg-sky-100 text-sky-700", label: "Tareas" };
  if (type.startsWith("crm_")) return { icon: ArrowUpRight, iconClass: "bg-amber-100 text-amber-700", label: "CRM" };
  if (type.startsWith("absence")) return { icon: Users, iconClass: "bg-emerald-100 text-emerald-700", label: "Equipo" };
  return { icon: Bell, iconClass: "bg-slate-100 text-slate-600", label: "Aviso" };
}

function dayGroup(dateValue: string) {
  const date = new Date(dateValue);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return "Anteriores";
}

function formatTime(dateValue: string) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(dateValue));
}

function groupNotifications(items: ProductNotification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const activeGroups = new Map<string, NotificationGroup>();
  for (const item of items) {
    const groupable = ["mind_reply", "mind_daily", "task_reply"].includes(item.type);
    const itemDate = new Date(item.createdAt);
    const date = `${itemDate.getFullYear()}-${itemDate.getMonth() + 1}-${itemDate.getDate()}`;
    const destination = item.actionUrl || `${item.entityType ?? "notice"}:${item.entityId ?? item.id}`;
    const baseKey = groupable ? `${date}:${item.type}:${destination}` : `item:${item.id}`;
    const current = activeGroups.get(baseKey);
    const withinWindow = current && Date.now() - new Date(current.latest.createdAt).getTime() <= (item.type === "mind_daily" ? 24 : 4) * 60 * 60 * 1000;
    if (current && withinWindow) {
      current.items.push(item);
      if (!item.readAt) current.unreadIds.push(item.id);
    } else {
      const group = { key: `${baseKey}:${item.id}`, items: [item], latest: item, unreadIds: item.readAt ? [] : [item.id] };
      groups.push(group);
      if (groupable) activeGroups.set(baseKey, group);
    }
  }
  return groups;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = (user as any)?.id;
  const [desktopStatus, setDesktopStatus] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const preferencesQuery = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences", userId],
    queryFn: async () => {
      const response = await authFetch("/api/notifications/preferences");
      if (!response.ok) throw new Error("No se pudieron cargar las preferencias");
      return response.json();
    },
  });
  const notificationQuery = useInfiniteQuery<NotificationPage>({
    queryKey: ["/api/notifications", userId, "history", unreadOnly],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "30" });
      if (pageParam) params.set("beforeId", String(pageParam));
      if (unreadOnly) params.set("unreadOnly", "true");
      const response = await authFetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error("No se pudieron cargar las notificaciones");
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: Boolean(userId),
  });
  const items = useMemo(() => notificationQuery.data?.pages.flatMap((page) => page.items) ?? [], [notificationQuery.data]);
  const groups = useMemo(() => groupNotifications(items), [items]);
  const unreadCount = notificationQuery.data?.pages[0]?.unreadCount ?? 0;
  const preferences = preferencesQuery.data;

  const markOneMutation = useMutation({
    mutationFn: (ids: number[]) => ids.length === 1
      ? apiRequest(`/api/notifications/${ids[0]}/read`, "PATCH")
      : apiRequest("/api/notifications/read-many", "PATCH", { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });
  const markAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications/read-all", "PATCH"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const savePreferencesMutation = useMutation({
    mutationFn: (next: NotificationPreferences) => apiRequest("/api/notifications/preferences", "PUT", {
      desktopEnabled: next.desktopEnabled,
      emailEnabled: next.emailEnabled,
      categoryPreferences: next.categoryPreferences ?? {},
      discreetMode: next.discreetMode ?? true,
    }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] }),
  });
  const updateCategory = (category: Category, channel: "desktop" | "email", enabled: boolean) => {
    if (!preferences) return;
    const current = preferences.categoryPreferences ?? {};
    void savePreferencesMutation.mutate({
      ...preferences,
      categoryPreferences: { ...current, [category]: { ...current[category], [channel]: enabled } },
    });
  };

  const sections = useMemo(() => {
    const byDay = new Map<string, NotificationGroup[]>();
    for (const group of groups) {
      const section = dayGroup(group.latest.createdAt);
      byDay.set(section, [...(byDay.get(section) ?? []), group]);
    }
    return ["Hoy", "Ayer", "Anteriores"].flatMap((label) => {
      const group = byDay.get(label);
      return group?.length ? [{ label, groups: group }] : [];
    });
  }, [groups]);

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 text-white shadow-xl sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-sky-300" /> Tu actividad, en un solo lugar
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Notificaciones</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Avisos de los espacios y tareas que seguís, ordenados para que encuentres rápido lo que necesita tu atención.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur">
              <p className="text-2xl font-semibold leading-none">{unreadCount}</p>
              <p className="mt-1 text-[11px] text-slate-300">sin leer</p>
            </div>
            <Button
              variant="secondary"
              className="h-11 rounded-xl bg-white text-slate-900 shadow-sm hover:bg-slate-100"
              disabled={!unreadCount || markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              <CheckCheck className="mr-2 h-4 w-4" /> Marcar todo leído
            </Button>
          </div>
        </div>
      </header>

      {markAllMutation.isError && <p role="alert" className="text-sm text-destructive">No pudimos actualizar los avisos. Volvé a intentarlo.</p>}
      {markOneMutation.isError && <p role="alert" className="text-sm text-destructive">No pudimos marcar el aviso como leído. Volvé a intentarlo.</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Historial de notificaciones" className="min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold text-slate-900">Tu actividad</h2>
              <p className="mt-0.5 text-xs text-slate-500">Los avisos más recientes aparecen primero.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{items.length} cargadas</span>
          </div>
          <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2 sm:px-6" role="group" aria-label="Filtrar notificaciones">
            <button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", !unreadOnly ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}>Todas</button>
            <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", unreadOnly ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100")}>Sin leer{unreadCount > 0 && <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]", unreadOnly ? "bg-white/20" : "bg-slate-100")}>{unreadCount}</span>}</button>
          </div>

          {notificationQuery.isLoading ? (
            <div className="space-y-3 p-5" aria-label="Cargando notificaciones">
              {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : notificationQuery.isError ? (
            <div className="p-10 text-center">
              <BellOff className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-800">No pudimos cargar tus avisos</p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => void notificationQuery.refetch()}>Reintentar</Button>
            </div>
          ) : sections.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-500"><Inbox className="h-6 w-6" /></div>
              <h3 className="mt-4 font-semibold text-slate-900">{unreadOnly ? "No tenés pendientes" : "Todo al día"}</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{unreadOnly ? "Todos tus avisos están marcados como leídos." : "Cuando haya una novedad relevante para vos, la vas a encontrar acá."}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sections.map((section) => (
                <div key={section.label} className="px-4 py-4 sm:px-6">
                  <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{section.label}</h3>
                  <div className="space-y-2">
                    {section.groups.map((group) => {
                      const item = group.latest;
                      const style = typeStyle(item.type);
                      const Icon = style.icon;
                      const isUnread = group.unreadIds.length > 0;
                      const displayTitle = group.items.length > 1
                        ? item.type === "mind_daily" ? `${group.items.length} dailies completadas` : `${group.items.length} respuestas nuevas`
                        : item.title;
                      const markGroupRead = () => group.unreadIds.length && markOneMutation.mutate(group.unreadIds);
                      return (
                        <article key={group.key} className={cn(
                          "group relative flex gap-3 rounded-2xl border p-3.5 transition-all sm:gap-4 sm:p-4",
                          isUnread ? "border-indigo-100 bg-indigo-50/55 hover:border-indigo-200 hover:bg-indigo-50" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50/70",
                        )}>
                          {isUnread && <span className="absolute left-0 top-5 h-6 w-1 rounded-r-full bg-indigo-500" aria-label="Sin leer" />}
                          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", style.iconClass)}><Icon className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h4 className="text-sm font-semibold text-slate-900">{displayTitle}</h4>
                              {group.items.length > 1 && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-500">{group.items.length} avisos</span>}
                              {isUnread && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-700">Nuevo</span>}
                            </div>
                            <p className="mt-1 text-sm leading-5 text-slate-600">{item.message}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Link href={notificationHref(item)} onClick={markGroupRead} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700">
                                Abrir <ArrowUpRight className="h-3 w-3" />
                              </Link>
                              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-slate-500">{style.label}</span>
                              {isUnread && (
                                <button type="button" className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={markGroupRead} aria-label={`Marcar como leídos: ${displayTitle}`}>
                                  <Check className="h-3.5 w-3.5" /> Marcar leído
                                </button>
                              )}
                              <time className="ml-auto text-[11px] tabular-nums text-slate-400" dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {notificationQuery.data?.pages.at(-1)?.hasMore && (
            <div className="border-t border-slate-100 px-5 py-4 text-center">
              <Button variant="ghost" className="rounded-xl text-slate-600" disabled={notificationQuery.isFetchingNextPage} onClick={() => void notificationQuery.fetchNextPage()}>
                {notificationQuery.isFetchingNextPage ? "Cargando…" : "Cargar anteriores"}<ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </section>

        <aside id="preferencias" className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Settings2 className="h-5 w-5" /></div>
              <div><h2 className="font-semibold text-slate-900">Cómo querés recibirlas</h2><p className="mt-1 text-xs leading-5 text-slate-500">Elegí tus canales y ajustá cada tipo de aviso.</p></div>
            </div>
            {preferences && (
              <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-3">
                  <div className="flex items-center gap-2.5"><Monitor className="h-4 w-4 text-slate-500" /><div><p className="text-sm font-medium text-slate-800">Escritorio</p><p className="text-[10px] text-slate-500">Incluso con Mind cerrado</p></div></div>
                  <Switch checked={preferences.desktopEnabled} aria-label="Activar notificaciones de escritorio" onCheckedChange={(checked) => {
                    setDesktopStatus("");
                    const request = async () => {
                      try {
                        if (checked) await enableWebPush();
                        else await disableWebPush();
                        setDesktopStatus(checked ? "Este dispositivo ya puede recibir avisos aunque Mind esté cerrado." : "Se desactivaron los avisos en este dispositivo.");
                        savePreferencesMutation.mutate({ ...preferences, desktopEnabled: checked });
                      } catch {
                        setDesktopStatus("No pudimos conectar este dispositivo. Revisá el permiso del navegador y volvé a intentar.");
                      }
                    };
                    void request();
                  }} />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-3">
                  <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-slate-500" /><div><p className="text-sm font-medium text-slate-800">Email</p><p className="text-[10px] text-slate-500">A tu correo de Mind</p></div></div>
                  <Switch checked={preferences.emailEnabled} aria-label="Activar notificaciones por email" onCheckedChange={(checked) => void savePreferencesMutation.mutate({ ...preferences, emailEnabled: checked })} />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-3">
                  <div className="pr-3"><p className="text-sm font-medium text-slate-800">Vista privada</p><p className="text-[10px] leading-4 text-slate-500">Oculta los detalles en pantalla y correo.</p></div>
                  <Switch checked={preferences.discreetMode !== false} aria-label="Ocultar detalles sensibles en notificaciones" onCheckedChange={(checked) => void savePreferencesMutation.mutate({ ...preferences, discreetMode: checked })} />
                </div>
            <p className="px-1 text-[11px] leading-5 text-slate-500">{desktopStatus || "Los avisos de escritorio requieren permiso en cada navegador y dispositivo."} Podés cambiar la configuración cuando quieras.</p>
              </div>
            )}
            {savePreferencesMutation.isError && <p role="alert" className="mt-3 text-xs text-destructive">No pudimos guardar tus preferencias. Probá otra vez.</p>}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4"><h2 className="font-semibold text-slate-900">Elegí qué te llega</h2><p className="mt-1 text-xs leading-5 text-slate-500">Ajustá escritorio y email por categoría.</p></div>
            <div className="space-y-1">
              <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><span>Tipo de aviso</span><span className="text-center">PC</span><span className="text-center">Mail</span></div>
              {categories.map((category) => {
                const saved = preferences?.categoryPreferences?.[category.key] ?? {};
                return (
                  <div key={category.key} className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center gap-1 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                    <div className="min-w-0"><p className="truncate text-xs font-medium text-slate-800">{category.label}</p><p className="truncate text-[10px] text-slate-500">{category.detail}</p></div>
                    <Switch className="mx-auto h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4" checked={saved.desktop !== false} disabled={!preferences?.desktopEnabled || savePreferencesMutation.isPending} aria-label={`${category.label}: escritorio`} onCheckedChange={(checked) => updateCategory(category.key, "desktop", checked)} />
                    <Switch className="mx-auto h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4" checked={saved.email !== false} disabled={!preferences?.emailEnabled || savePreferencesMutation.isPending} aria-label={`${category.label}: email`} onCheckedChange={(checked) => updateCategory(category.key, "email", checked)} />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-indigo-50 px-3.5 py-3 text-xs leading-5 text-indigo-900"><Circle className="mt-1 h-2 w-2 shrink-0 fill-indigo-500 text-indigo-500" /><p>El centro de notificaciones conserva tu historial aunque pauses los avisos por escritorio o email.</p></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
