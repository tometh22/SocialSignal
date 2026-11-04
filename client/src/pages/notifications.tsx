import { groupNotifications, defaultNotificationSettings, safeNotificationPath, type NotificationSettings } from "@shared/utils/notification-policy";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight, Bell, BellOff, Check, CheckCheck, ChevronDown, Circle, ClipboardList,
  Inbox, Mail, MessageCircle, Monitor, Send, Settings2, Sparkles, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { authFetch, apiRequest } from "@/lib/queryClient";
import { disableWebPush, enableWebPush, getWebPushState } from "@/lib/notification-push";
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
  threadKey?: string | null;
  muted?: boolean;
};
type Category = "mind" | "daily" | "tasks" | "crm" | "team" | "quotations";
type CategoryChannelPreferences = Record<string, { desktop?: boolean; email?: boolean }>;
type NotificationPreferences = {
  emailSuppressed?: boolean;
  settings?: NotificationSettings;
  availableCategories?: Category[];
  desktopEnabled: boolean;
  emailEnabled: boolean;
  discreetMode?: boolean;
  categoryPreferences?: CategoryChannelPreferences;
};
type NotificationPage = { items: ProductNotification[]; unreadCount: number; hasMore: boolean; nextCursor: number | null };
type NotificationGroup = { key: string; items: ProductNotification[]; latest: ProductNotification; unreadIds: number[] };
type PushTestStatus = { kind: "success" | "warning" | "error"; message: string };

const categories: { key: Category; label: string; detail: string }[] = [
  { key: "mind", label: "Conversaciones en Mind", detail: "Respuestas en los espacios que seguís" },
  { key: "daily", label: "Dailies", detail: "Cuando alguien completa una daily en tus espacios" },
  { key: "tasks", label: "Tareas", detail: "Asignaciones y nuevas respuestas" },
  { key: "crm", label: "CRM", detail: "Recordatorios asignados a vos" },
  { key: "quotations", label: "Cotizaciones", detail: "Solicitudes de aprobación comercial" },
  { key: "team", label: "Equipo", detail: "Solicitudes y decisiones de ausencias" },
];

function notificationHref(item: ProductNotification) { return safeNotificationPath(item.actionUrl); }

function deliveryStatusLabel(status:string) {
  return ({pending:"Pendiente",processing:"En proceso",sent:"Aceptado",accepted:"Aceptado",failed:"Fallido",cancelled:"Cancelado",delivered:"Entregado",delivery_delayed:"Demorado",bounced:"Rebotó",complained:"Marcado como spam",suppressed:"Bloqueado",uncertain:"Revisar proveedor"} as Record<string,string>)[status]??status;
}

function typeStyle(type: string) {
  if (type.startsWith("mind_")) return { icon: MessageCircle, iconClass: "bg-violet-100 text-violet-700", label: "Mind" };
  if (type.startsWith("task_")) return { icon: ClipboardList, iconClass: "bg-sky-100 text-sky-700", label: "Tareas" };
  if (type.startsWith("crm_")) return { icon: ArrowUpRight, iconClass: "bg-amber-100 text-amber-700", label: "CRM" };
  if (type.startsWith("quotation_")) return { icon: ClipboardList, iconClass: "bg-indigo-100 text-indigo-700", label: "Cotizaciones" };
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
  const date=new Date(dateValue);
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit",...(dayGroup(dateValue)==="Hoy"?{}:{day:"2-digit",month:"2-digit",...(date.getFullYear()!==new Date().getFullYear()?{year:"numeric"}:{})}) } as Intl.DateTimeFormatOptions).format(date);
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = (user as any)?.id;
  const [desktopStatus, setDesktopStatus] = useState("");
  const [deviceBusy, setDeviceBusy] = useState(false);
  const deviceQuery = useQuery({ queryKey:["notification-device",userId],queryFn:getWebPushState,enabled:Boolean(userId),refetchOnWindowFocus:true,staleTime:0 });
  const devicesQuery = useQuery<{ id:number; userAgent:string|null; current:boolean }[]>({ queryKey:["notification-devices",userId],queryFn:async()=>{const r=await authFetch("/api/notifications/push/devices"); if(!r.ok) throw new Error("No se pudieron cargar los dispositivos"); return r.json();},enabled:Boolean(userId) });
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
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const items = useMemo(() => notificationQuery.data?.pages.flatMap((page) => page.items) ?? [], [notificationQuery.data]);
  const groups = useMemo(() => groupNotifications(items), [items]);
  const unreadCount = notificationQuery.data?.pages[0]?.unreadCount ?? 0;
  const preferences = preferencesQuery.data;
  const [pushTestStatus, setPushTestStatus] = useState<PushTestStatus | null>(null);
  const [pushTestCooldown, setPushTestCooldown] = useState(0);

  useEffect(() => {
    if (pushTestCooldown <= 0) return;
    const timer = window.setTimeout(() => setPushTestCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [pushTestCooldown]);

  const markOneMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      for (let offset=0;offset<ids.length;offset+=100) {
        await apiRequest("/api/notifications/read-many","PATCH",{ids:ids.slice(offset,offset+100)});
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });
  const markAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications/read-all", "PATCH"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
  const savePreferencesMutation = useMutation({
    mutationFn: (next: Partial<NotificationPreferences>) => apiRequest("/api/notifications/preferences", "PUT", next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] }),
  });
  const testPushMutation = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error("Este navegador todavía no está conectado a Mind.");
      const testId = crypto.randomUUID();
      let cancelPushWait = () => {};
      const pushReceived = new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => {
          navigator.serviceWorker.removeEventListener("message", onMessage);
          resolve(false);
        }, 12_000);
        const onMessage = (event: MessageEvent) => {
          if (event.data?.type !== "mind-push-test-result" || event.data.testId !== testId) return;
          window.clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener("message", onMessage);
          resolve(event.data.shown === true);
        };
        cancelPushWait = () => {
          window.clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener("message", onMessage);
          resolve(false);
        };
        navigator.serviceWorker.addEventListener("message", onMessage);
      });
      let response: Response;
      try {
        response = await authFetch("/api/notifications/push/test", {
          method: "POST",
          body: JSON.stringify({ endpoint: subscription.endpoint, testId }),
        });
      } catch (error) {
        cancelPushWait();
        throw error;
      }
      if (!response.ok) {
        cancelPushWait();
        const body = await response.json().catch(() => ({})) as { message?: string };
        const error = new Error(body.message || "No pudimos enviar el aviso de prueba.");
        Object.assign(error, { status: response.status });
        throw error;
      }
      const shown = await pushReceived;
      return { shown };
    },
    onSuccess: ({ shown }) => {
      setPushTestCooldown(30);
      setPushTestStatus(shown
        ? { kind: "success", message: "El navegador recibió la prueba y creó la notificación. Si no viste el aviso en pantalla, revisá el centro de notificaciones del sistema." }
        : { kind: "warning", message: "El servicio aceptó el envío, pero el navegador no confirmó que lo haya recibido. Revisá que Mind esté abierto en este mismo perfil del navegador y volvé a activar las notificaciones." });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "No pudimos enviar el aviso de prueba.";
      if ((error as Error & { status?: number })?.status === 429) {
        setPushTestCooldown(30);
        setPushTestStatus({ kind: "error", message: "Ya enviamos una prueba hace poco. Esperá a que termine el contador para volver a probar." });
        return;
      }
      setPushTestStatus({ kind: "error", message });
    },
  });
  const updateCategory = (category: Category, channel: "desktop" | "email", enabled: boolean) => {
    if (!preferences) return;
    const current = preferences.categoryPreferences ?? {};
    void savePreferencesMutation.mutate({
      categoryPreferences: { [category]: { [channel]: enabled } },
    });
  };

  type DeliveryOverview={configured:boolean;provider:string|null;webhookConfigured:boolean;counts:Record<string,number>;deliveryCounts:Record<string,number>;pushCounts:Record<string,number>;attention:{id:number;status:string;lastError:string|null;title:string}[];providerLogs:{idempotency_key:string;provider:string;recipient:string;status:string;delivery_status:string|null;last_error:string|null}[]};
  const isAdmin=Boolean(user?.isAdmin || user?.role === "admin");
  const deliveryQuery=useQuery<DeliveryOverview>({queryKey:["notification-delivery-overview",userId],queryFn:async()=>{const r=await authFetch("/api/admin/notification-email-deliveries");if(!r.ok)throw new Error("No se pudieron cargar los envíos");return r.json();},enabled:isAdmin,refetchInterval:30_000});
  const retryDelivery=useMutation({mutationFn:(id:number)=>apiRequest(`/api/admin/notification-email-deliveries/${id}/retry`,"POST"),onSuccess:()=>deliveryQuery.refetch()});
  const releaseSuppression=useMutation({mutationFn:(email:string)=>apiRequest("/api/admin/notification-email-suppressions/release","POST",{email}),onSuccess:()=>queryClient.invalidateQueries({queryKey:["/api/notifications/preferences"]})});
  const muteMutation = useMutation({ mutationFn:({id,muted}:{id:number;muted:boolean})=>apiRequest(`/api/notifications/${id}/mute`,"POST",{muted}),onSuccess:()=>queryClient.invalidateQueries({queryKey:["/api/notifications"]}) });
  const removeDevice = useMutation({mutationFn:(id:number)=>apiRequest(`/api/notifications/push/devices/${id}`,"DELETE"),onSuccess:async()=>{await Promise.all([deviceQuery.refetch(),devicesQuery.refetch()]);}});
  const settings = preferences?.settings ?? defaultNotificationSettings;
  const updateSettings = (patch: Partial<NotificationSettings>) => savePreferencesMutation.mutate({settings:{...settings,...patch}});
  const connectDevice = async () => {
    setDeviceBusy(true); setDesktopStatus("");
    try { await enableWebPush(); await savePreferencesMutation.mutateAsync({desktopEnabled:true}); await Promise.all([deviceQuery.refetch(),devicesQuery.refetch()]);setDesktopStatus("Este navegador está conectado."); }
    catch(error) { setDesktopStatus(error instanceof Error ? error.message : "No pudimos conectar el navegador."); }
    finally {setDeviceBusy(false);}
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
      {muteMutation.isError && <p role="alert" className="text-sm text-destructive">No pudimos cambiar los avisos de esta conversación.</p>}
      {markOneMutation.isError && <p role="alert" className="text-sm text-destructive">No pudimos marcar el aviso como leído. Volvé a intentarlo.</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                        ? item.type === "mind_daily" ? `${group.items.length} dailies completadas` : `${group.unreadIds.length || group.items.length} respuestas${group.unreadIds.length ? " nuevas" : ""}`
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
                              {item.threadKey && <button type="button" disabled={muteMutation.isPending} className="text-xs text-slate-500 hover:underline" onClick={()=>muteMutation.mutate({id:item.id,muted:!item.muted})}>{item.muted ? "Volver a avisar" : "Silenciar avisos"}</button>}
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
            {preferencesQuery.isPending && <p role="status" className="mt-4 text-xs text-slate-500">Cargando preferencias…</p>}
            {preferencesQuery.isError && <p role="alert" className="mt-4 text-xs text-destructive">No pudimos cargar tus preferencias. <button className="underline" onClick={()=>void preferencesQuery.refetch()}>Reintentar</button></p>}
            {preferences && (
              <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-3">
                  <div className="flex items-center gap-2.5"><Monitor className="h-4 w-4 text-slate-500" /><div><p className="text-sm font-medium text-slate-800">Escritorio</p><p className="text-[10px] text-slate-500">Preferencia para todos tus dispositivos</p></div></div>
                  <Switch checked={preferences.desktopEnabled} disabled={savePreferencesMutation.isPending} aria-label="Activar avisos de escritorio en todos los dispositivos" onCheckedChange={checked=>savePreferencesMutation.mutate({desktopEnabled:checked})} />
                </div>
                <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2">
                  <p className="text-xs font-semibold">Este navegador</p>
                  <p role="status" className="text-xs text-slate-500">{deviceQuery.isError ? "No pudimos comprobar la conexión." : deviceQuery.isPending ? "Comprobando…" : !deviceQuery.data?.supported ? "No admite Web Push. Podés usar email o la bandeja." : deviceQuery.data.connected ? preferences.desktopEnabled ? "Conectado" : "Conectado · avisos pausados" : deviceQuery.data.permission === "denied" ? "Permiso bloqueado. Habilitalo desde los ajustes del sitio." : "Sin conectar"}</p>
                  {!deviceQuery.data?.connected && deviceQuery.data?.supported && <Button size="sm" variant="outline" disabled={deviceBusy} onClick={()=>void connectDevice()}>{deviceBusy?"Conectando…":"Conectar este navegador"}</Button>}
                  {deviceQuery.data?.connected && <Button size="sm" variant="outline" disabled={deviceBusy} onClick={async()=>{setDeviceBusy(true);try{await disableWebPush();await Promise.all([deviceQuery.refetch(),devicesQuery.refetch()]);}catch{setDesktopStatus("No pudimos desconectar el navegador.");}finally{setDeviceBusy(false);}}}>Desconectar este navegador</Button>}
                  {devicesQuery.data?.filter(d=>!d.current).map(d=><div key={d.id} className="flex items-center justify-between gap-2 text-xs"><span className="truncate" title={d.userAgent??""}>{d.userAgent?.includes("Edg/")?"Edge":d.userAgent?.includes("Firefox/")?"Firefox":d.userAgent?.includes("Chrome/")?"Chrome":"Otro navegador"} · dispositivo {d.id}</span><button className="underline" disabled={removeDevice.isPending} onClick={()=>removeDevice.mutate(d.id)}>Desconectar</button></div>)}
                  {(devicesQuery.isError || removeDevice.isError) && <p role="alert" className="text-xs text-destructive">No pudimos actualizar tus dispositivos.</p>}
                </div>
                {preferences.desktopEnabled && deviceQuery.data?.connected && (
                  <>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-3">
                    <div className="min-w-0"><p className="text-xs font-medium text-slate-800">Comprobá este dispositivo</p><p className="text-[10px] text-slate-500">Te enviamos un aviso de prueba.</p></div>
                    <Button size="sm" variant="outline" className="shrink-0 rounded-lg bg-white" disabled={testPushMutation.isPending || pushTestCooldown > 0} onClick={() => {
                      setPushTestStatus(null);
                      testPushMutation.mutate();
                    }}>
                      <Send className="mr-1.5 h-3.5 w-3.5" />{testPushMutation.isPending ? "Comprobando…" : pushTestCooldown > 0 ? `Probar en ${pushTestCooldown}s` : "Probar"}
                    </Button>
                  </div>
                  {pushTestStatus && (
                    <p role={pushTestStatus.kind === "error" ? "alert" : "status"} aria-live={pushTestStatus.kind === "error" ? "assertive" : "polite"}
                      className={cn("rounded-xl border px-3.5 py-3 text-xs leading-5", pushTestStatus.kind === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : pushTestStatus.kind === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-950"
                          : "border-rose-200 bg-rose-50 text-rose-900")}>
                      {pushTestStatus.message}
                    </p>
                  )}
                  </>
                )}
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3.5 py-3">
                  <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-slate-500" /><div><p className="text-sm font-medium text-slate-800">Email</p><p className="text-[10px] text-slate-500">A tu correo de Mind</p></div></div>
                  <Switch checked={preferences.emailEnabled} aria-label="Activar notificaciones por email" disabled={savePreferencesMutation.isPending} onCheckedChange={(checked) => void savePreferencesMutation.mutate({ emailEnabled: checked })} />
                </div>
                {preferences.emailSuppressed && <p role="alert" className="text-xs text-destructive">El proveedor bloqueó los envíos a tu dirección por un rebote o una queja. Administración debe revisar tu correo antes de reactivarlos.</p>}
                <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-3">
                  <div className="pr-3"><p className="text-sm font-medium text-slate-800">Vista privada</p><p className="text-[10px] leading-4 text-slate-500">Oculta los detalles en pantalla y correo.</p></div>
                  <Switch checked={preferences.discreetMode !== false} aria-label="Ocultar detalles sensibles en notificaciones" disabled={savePreferencesMutation.isPending} onCheckedChange={(checked) => void savePreferencesMutation.mutate({ discreetMode: checked })} />
                </div>
            <p className="px-1 text-[11px] leading-5 text-slate-500">{desktopStatus || "Los avisos de escritorio requieren permiso en cada navegador y dispositivo."} Podés cambiar la configuración cuando quieras.</p>
              </div>
            )}
            {preferences && <fieldset disabled={savePreferencesMutation.isPending} className="mt-5 space-y-3 border-t pt-4">
              <legend className="text-sm font-semibold">Frecuencia y descanso</legend>
              <label className="block text-xs">Mails de conversaciones y dailies
                <select className="mt-1 w-full rounded-lg border p-2 bg-white" value={settings.activityEmailMode} onChange={e=>updateSettings({activityEmailMode:e.target.value as NotificationSettings["activityEmailMode"]})}><option value="daily">Resumen diario</option><option value="immediate">En el momento</option><option value="off">Solo en la bandeja y escritorio</option></select>
              </label>
              <p className="text-xs text-slate-500">Las asignaciones, aprobaciones y recordatorios se envían en el momento, respetando tus horarios.</p>
              {settings.activityEmailMode === "daily" && <label className="block text-xs">Hora del resumen<select className="ml-2 rounded border p-1" value={settings.digestHour} onChange={e=>updateSettings({digestHour:Number(e.target.value)})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}</select></label>}
              <label className="flex items-center justify-between text-xs">Horario silencioso<Switch checked={settings.quietHours.enabled} onCheckedChange={enabled=>updateSettings({quietHours:{...settings.quietHours,enabled}})} /></label>
              {settings.quietHours.enabled && <div className="flex gap-3 text-xs">{(["start","end"] as const).map(key=><label key={key}>{key==="start"?"Desde":"Hasta"}<select className="ml-2 rounded border p-1" value={settings.quietHours[key]} onChange={e=>updateSettings({quietHours:{...settings.quietHours,[key]:Number(e.target.value)}})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}</select></label>)}</div>}
              <label className="block text-xs">Zona horaria<select className="mt-1 w-full rounded border p-2 bg-white" value={settings.timeZone} onChange={e=>updateSettings({timeZone:e.target.value})}>{[...new Set([settings.timeZone,Intl.DateTimeFormat().resolvedOptions().timeZone,"America/Argentina/Buenos_Aires","America/Mexico_City","America/Bogota","America/Santiago","Europe/Madrid","UTC"])].map(zone=><option key={zone} value={zone}>{zone}</option>)}</select></label>
              <p className="text-xs text-slate-500">El horario silencioso demora mails y push. La bandeja sigue disponible.</p>
            </fieldset>}
            {savePreferencesMutation.isError && <p role="alert" className="mt-3 text-xs text-destructive">No pudimos guardar tus preferencias. Probá otra vez.</p>}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4"><h2 className="font-semibold text-slate-900">Elegí qué te llega</h2><p className="mt-1 text-xs leading-5 text-slate-500">Ajustá escritorio y email por categoría.</p></div>
            <div className="space-y-1">
              <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] items-center px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><span>Tipo de aviso</span><span className="text-center">PC</span><span className="text-center">Mail</span></div>
              {categories.filter(category=>preferences?.availableCategories?.includes(category.key)).map((category) => {
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
          {isAdmin && <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-semibold">Estado de los envíos</h2>
            {deliveryQuery.isPending && <p role="status" className="text-xs">Cargando envíos…</p>}
            {deliveryQuery.isError && <p role="alert" className="text-xs text-destructive">No pudimos consultar los envíos.</p>}
            {deliveryQuery.data && <>
              <p className="text-xs">Email: {deliveryQuery.data.configured ? deliveryQuery.data.provider : "sin configurar"} · Confirmación de entrega: {deliveryQuery.data.webhookConfigured ? "configurada" : "sin configurar"}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs">{[["Mails pendientes",deliveryQuery.data.counts.pending??0],["Mails fallidos",deliveryQuery.data.counts.failed??0],["Entregados",deliveryQuery.data.deliveryCounts.delivered??0],["Rebotes",deliveryQuery.data.deliveryCounts.bounced??0],["Push pendientes",deliveryQuery.data.pushCounts.pending??0],["Push fallidos",deliveryQuery.data.pushCounts.failed??0]].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-2"><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
              <p className="text-xs text-slate-500">Aceptado significa que el proveedor recibió el pedido. Entregado confirma llegada al servidor del destinatario.</p>
              {deliveryQuery.data.attention.slice(0,8).map(d=><div key={d.id} className="border-t pt-2 text-xs"><p>{d.title} · {deliveryStatusLabel(d.status)}</p>{d.lastError&&<p className="mt-1 text-slate-500">{d.lastError}</p>}{d.status==="failed"&&<button className="mt-1 underline" disabled={retryDelivery.isPending} onClick={()=>retryDelivery.mutate(d.id)}>Reintentar envío</button>}</div>)}
              {!!deliveryQuery.data.providerLogs.length && <details className="text-xs"><summary className="cursor-pointer font-medium">Todos los correos · últimos envíos</summary>{deliveryQuery.data.providerLogs.map(d=><div key={d.idempotency_key} className="border-t mt-2 pt-2 break-all"><p>{d.recipient}</p><p>{d.provider} · {deliveryStatusLabel(d.delivery_status??d.status)}</p>{d.last_error&&<p className="text-destructive">{d.last_error}</p>}{["bounced","complained","suppressed"].includes(d.delivery_status??"")&&<div className="mt-1"><p className="text-slate-500">Corregí la dirección o resolvé el bloqueo en el proveedor antes de habilitar nuevos avisos.</p><button className="mt-1 underline" disabled={releaseSuppression.isPending} onClick={()=>releaseSuppression.mutate(d.recipient)}>Habilitar avisos tras revisión</button></div>}</div>)}</details>}
            </>}
            {releaseSuppression.isSuccess&&<p role="status" className="text-xs">Se habilitaron los nuevos avisos para la dirección revisada.</p>}
            {releaseSuppression.isError&&<p role="alert" className="text-xs text-destructive">No pudimos habilitar esa dirección.</p>}
            {retryDelivery.isError && <p role="alert" className="text-xs text-destructive">No pudimos reencolar el envío.</p>}
          </section>}
        </aside>
      </div>
    </div>
  );
}
