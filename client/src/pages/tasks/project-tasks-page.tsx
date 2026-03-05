import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Loader2, Users, Trash2, Plus, ChevronRight, List, LayoutGrid, Share2, Filter, ArrowUpDown, Layers, MoreHorizontal, Search, X, Check, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import ProjectTaskList from "@/components/tasks/ProjectTaskList";
import ProjectOverviewPanel from "@/components/tasks/ProjectOverviewPanel";

type ProjectMember = { personnelId: number; name: string; role: string };
type TaskProject = {
  id: number;
  name: string;
  clientName: string | null;
  status: string;
  taskCount: number;
  pendingCount: number;
  totalHours: number;
  members: ProjectMember[];
};
type Personnel = { id: number; name: string; email?: string | null };

const PROJECT_PALETTE = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

function getProjectColor(id: number) {
  return PROJECT_PALETTE[id % PROJECT_PALETTE.length];
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

interface Props {
  params: { id: string };
}

export default function ProjectTasksPage({ params }: Props) {
  const projectId = parseInt(params.id);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addPersonnelId, setAddPersonnelId] = useState<string>("none");
  const [addRole, setAddRole] = useState("member");
  const [view, setView] = useState<"list" | "board" | "panel">("list");
  const [quickAddTrigger, setQuickAddTrigger] = useState(0);
  const [showFilter, setShowFilter] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [localMembers, setLocalMembers] = useState<ProjectMember[] | null>(null);
  const [sortBy, setSortBy] = useState("default");
  const [groupBy, setGroupBy] = useState("section");

  const { data: project, isLoading } = useQuery<TaskProject>({
    queryKey: ["/api/tasks/projects", projectId],
    queryFn: () => authFetch(`/api/tasks/projects/${projectId}`).then(r => r.json()),
    enabled: !!projectId,
  });

  const { data: allPersonnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
  });

  // Sync local members from server data (after refetch, reset override)
  useEffect(() => {
    if (project?.members) {
      setLocalMembers(null);
    }
  }, [project?.members]);

  const members: ProjectMember[] = localMembers ?? (project?.members ?? []);

  const addMemberMutation = useMutation({
    mutationFn: ({ personnelId, role }: { personnelId: number; role: string }) =>
      apiRequest(`/api/tasks/projects/${projectId}/members`, "POST", { personnelId, role }),
    onMutate: ({ personnelId, role }) => {
      const person = allPersonnel.find(p => p.id === personnelId);
      if (person) {
        setLocalMembers(prev => {
          const base = prev ?? (project?.members ?? []);
          return [...base, { personnelId, name: person.name, role }];
        });
      }
      setAddPersonnelId("none");
    },
    onSuccess: () => {
      toast({ title: "Miembro agregado" });
    },
    onError: () => {
      setLocalMembers(null);
      toast({ title: "Error al agregar miembro", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (personnelId: number) =>
      apiRequest(`/api/tasks/projects/${projectId}/members/${personnelId}`, "DELETE"),
    onMutate: (personnelId) => {
      setLocalMembers(prev => {
        const base = prev ?? (project?.members ?? []);
        return base.filter(m => m.personnelId !== personnelId);
      });
    },
    onSuccess: () => {
      toast({ title: "Miembro quitado" });
    },
    onError: () => {
      setLocalMembers(null);
      toast({ title: "Error al quitar miembro", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
    },
  });

  const handleAddMember = () => {
    if (addPersonnelId === "none") return;
    addMemberMutation.mutate({ personnelId: parseInt(addPersonnelId), role: addRole });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Enlace copiado al portapapeles" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">Proyecto no encontrado</div>
    );
  }

  const dotColor = getProjectColor(project.id);
  const currentMemberIds = members.map(m => m.personnelId);
  const availablePersonnel = allPersonnel.filter(p => !currentMemberIds.includes(p.id));
  const visibleMembers = members.slice(0, 6);
  const extraMembers = members.length - 6;

  return (
    <TooltipProvider>
      <div className="space-y-0 max-w-6xl mx-auto">
        {/* ─── Sticky header ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
            <Link href="/tasks" className="hover:text-foreground transition-colors">Tareas</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/tasks/projects" className="hover:text-foreground transition-colors">Proyectos</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">
              {project.clientName ? `${project.clientName} · ` : ""}{project.name}
            </span>
          </nav>

          {/* Project header */}
          <div className="border-b border-border pb-3 mb-0">
            <div className="flex items-start justify-between gap-4">
              {/* Left: icon + name + client */}
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                  "inline-flex w-9 h-9 rounded-xl flex-shrink-0 items-center justify-center text-white font-bold text-sm shadow-sm",
                  dotColor
                )}>
                  {(project.clientName || project.name || "P").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground truncate">{project.name}</h1>
                    <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50 flex-shrink-0">
                      Activo
                    </Badge>
                  </div>
                  {project.clientName && <p className="text-sm text-muted-foreground">{project.clientName}</p>}
                </div>
              </div>

              {/* Right: stats + actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Member avatars */}
                <div className="flex items-center gap-0.5">
                  {visibleMembers.map(m => (
                    <Tooltip key={m.personnelId}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-7 w-7 -ml-1 first:ml-0 ring-2 ring-background cursor-default">
                          <AvatarFallback className={cn("text-[9px] text-white", dotColor)}>
                            {getInitials(m.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{m.name} · {m.role === "owner" ? "Responsable" : "Miembro"}</TooltipContent>
                    </Tooltip>
                  ))}
                  {extraMembers > 0 && (
                    <div className="h-7 w-7 -ml-1 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                      +{extraMembers}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleShare}
                >
                  <Share2 className="h-3 w-3 mr-1.5" />
                  Compartir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setMembersOpen(true)}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Miembros
                </Button>

                {/* Stats */}
                <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground pl-2 border-l">
                  <span><strong className="text-foreground">{project.pendingCount}</strong> pendientes</span>
                  <span><strong className="text-foreground">{project.taskCount}</strong> total</span>
                  <span><strong className="text-foreground">{project.totalHours.toFixed(1)}h</strong> registradas</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {project.taskCount > 0 && (
              <div className="mt-3 mb-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>
                    {project.taskCount - project.pendingCount} de {project.taskCount} completadas
                  </span>
                  <span className="font-medium">
                    {Math.round(((project.taskCount - project.pendingCount) / project.taskCount) * 100)}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${Math.round(((project.taskCount - project.pendingCount) / project.taskCount) * 100)}%` }}
                  />
                </div>
              </div>
            )}

          {/* Tabs */}
            <div className="flex items-center gap-0 mt-3 border-b border-border -mb-[1px]">
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  view === "list"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </button>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  view === "board"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setView("board")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Tablero
              </button>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  view === "panel"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setView("panel")}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Panel
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        {view !== "panel" && (
        <div className="flex items-center justify-between py-2 border-b border-border gap-2">
          {view === "list" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-sm text-primary border-primary/40 hover:bg-primary/5 font-medium gap-1.5 flex-shrink-0"
              onClick={() => setQuickAddTrigger(v => v + 1)}
            >
              <Plus className="h-4 w-4" />
              Agregar tarea
            </Button>
          ) : (
            <div />
          )}

          {/* Filter input — shown inline when active */}
          {showFilter && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") { setFilterText(""); setShowFilter(false); }
                }}
                placeholder="Buscar tarea..."
                className="h-8 text-sm pl-8 pr-8"
              />
              {filterText && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setFilterText("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1.5 transition-colors",
                showFilter
                  ? "text-primary bg-primary/10 hover:bg-primary/15"
                  : "text-muted-foreground"
              )}
              onClick={() => {
                setShowFilter(v => !v);
                if (showFilter) setFilterText("");
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              {filterText ? (
                <span className="font-semibold">
                  Filtro activo
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[9px] px-1.5 leading-none inline-block">
                    {filterText}
                  </span>
                </span>
              ) : "Filtrar"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={sortBy !== "default" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />Ordenar
                  {sortBy !== "default" && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Ordenar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  { value: "default", label: "Predeterminado" },
                  { value: "dueDate_asc", label: "Fecha límite ↑" },
                  { value: "dueDate_desc", label: "Fecha límite ↓" },
                  { value: "priority", label: "Prioridad" },
                  { value: "title", label: "Nombre A→Z" },
                  { value: "assignee", label: "Responsable" },
                ].map(opt => (
                  <DropdownMenuItem key={opt.value} onClick={() => setSortBy(opt.value)} className="flex items-center justify-between">
                    {opt.label}
                    {sortBy === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={groupBy !== "section" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />Agrupar
                  {groupBy !== "section" && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Agrupar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  { value: "section", label: "Sección" },
                  { value: "assignee", label: "Responsable" },
                  { value: "priority", label: "Prioridad" },
                ].map(opt => (
                  <DropdownMenuItem key={opt.value} onClick={() => setGroupBy(opt.value)} className="flex items-center justify-between">
                    {opt.label}
                    {groupBy === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => { setSortBy("default"); setGroupBy("section"); }}
                  disabled={sortBy === "default" && groupBy === "section"}
                >
                  Restablecer vista
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleShare}>
                  Copiar enlace del proyecto
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-muted-foreground"
                  onClick={() => toast({ title: "Próximamente", description: "La función de archivar proyectos estará disponible pronto." })}
                >
                  Archivar proyecto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        )}

        {/* Panel overview */}
        {view === "panel" && (
          <ProjectOverviewPanel
            projectId={projectId}
            members={members}
            projectColor={dotColor}
          />
        )}

        {/* Task list / board */}
        {view !== "panel" && (
          <div className="pt-4">
            <ProjectTaskList
              projectId={projectId}
              projectMembers={members}
              view={view as "list" | "board"}
              clientName={project.clientName}
              onQuickAddTrigger={quickAddTrigger}
              filterText={filterText}
              sortBy={sortBy}
              groupBy={groupBy}
            />
          </div>
        )}
      </div>

      {/* Members management sheet */}
      <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Miembros del proyecto
            </SheetTitle>
            <p className="text-sm text-muted-foreground">{project.clientName ? `${project.clientName} · ` : ""}{project.name}</p>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            {/* Add member form */}
            <div className="bg-muted/30 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agregar miembro</p>
              <Select value={addPersonnelId} onValueChange={setAddPersonnelId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar persona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar persona...</SelectItem>
                  {availablePersonnel.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                            {getInitials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Responsable</SelectItem>
                    <SelectItem value="member">Miembro</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  className="h-9"
                  onClick={handleAddMember}
                  disabled={addPersonnelId === "none" || addMemberMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
            </div>

            {/* Members list */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Miembros actuales ({members.length})
              </p>
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-2">Sin miembros todavía</p>
              )}
              {members.map(m => (
                <div key={m.personnelId} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-accent/40 hover:bg-accent/60 transition-all duration-200 group animate-in fade-in slide-in-from-top-1">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={cn("text-xs font-semibold text-white", dotColor)}>
                      {getInitials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] h-4 px-1.5 mt-0.5",
                        m.role === "owner"
                          ? "text-amber-700 border-amber-300 bg-amber-50"
                          : "text-muted-foreground"
                      )}
                    >
                      {m.role === "owner" ? "Responsable" : "Miembro"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeMemberMutation.mutate(m.personnelId)}
                    disabled={removeMemberMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
