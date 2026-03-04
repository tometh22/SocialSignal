import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, Check, Users, LayoutGrid, List, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import NewProjectDialog from "@/components/tasks/NewProjectDialog";

type ProjectMember = { personnelId: number; name: string; role: string };
type TaskProject = {
  id: number;
  name: string;
  clientName: string | null;
  status: string;
  taskCount: number;
  pendingCount: number;
  lastActivity?: string;
  members: ProjectMember[];
  source?: string;
};
type Personnel = { id: number; name: string; email?: string | null };

const PALETTE_BG = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];
const PALETTE_LIGHT = [
  "bg-blue-50 text-blue-700", "bg-purple-50 text-purple-700",
  "bg-green-50 text-green-700", "bg-orange-50 text-orange-700",
  "bg-pink-50 text-pink-700", "bg-teal-50 text-teal-700",
  "bg-indigo-50 text-indigo-700", "bg-rose-50 text-rose-700",
];

function getPaletteBg(id: number) { return PALETTE_BG[id % PALETTE_BG.length]; }

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

function getProjectInitial(project: TaskProject) {
  const displayName = project.clientName && project.clientName !== "—"
    ? project.clientName
    : project.name;
  return displayName.charAt(0).toUpperCase() || "P";
}

function getProjectLabel(project: TaskProject) {
  if (project.clientName && project.clientName !== "—") return project.clientName;
  return null;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const completedPct = total === 0 ? 0 : Math.round(((total - done) / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{total - done} completadas</span>
        <span className="font-medium">{completedPct}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${completedPct}%` }}
        />
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: TaskProject;
  myPersonnelId?: number;
  onJoin: () => void;
  onLeave: () => void;
  joining: boolean;
  leaving: boolean;
}

function ProjectCard({ project, myPersonnelId, onJoin, onLeave, joining, leaving }: ProjectCardProps) {
  const bg = getPaletteBg(project.id);
  const isMember = myPersonnelId ? project.members.some(m => m.personnelId === myPersonnelId) : false;
  const visibleMembers = project.members.slice(0, 4);
  const overflow = project.members.length - 4;
  const doneCount = project.taskCount - project.pendingCount;
  const clientLabel = getProjectLabel(project);

  return (
    <div className="bg-card rounded-xl border border-border hover:border-border/80 hover:shadow-md transition-all duration-200 group flex flex-col overflow-hidden">
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/tasks/projects/${project.id}`} className="flex items-center gap-3 min-w-0 flex-1">
            <span className={cn(
              "inline-flex w-9 h-9 rounded-xl flex-shrink-0 items-center justify-center text-white font-bold text-sm shadow-sm",
              bg
            )}>
              {getProjectInitial(project)}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                {project.name || "(Sin nombre)"}
              </h3>
              {clientLabel && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{clientLabel}</p>
              )}
            </div>
          </Link>

          {myPersonnelId && (
            <button
              onClick={e => { e.preventDefault(); isMember ? onLeave() : onJoin(); }}
              disabled={joining || leaving}
              className={cn(
                "flex-shrink-0 h-6 px-2 rounded-md text-[11px] font-medium transition-all duration-150 border",
                isMember
                  ? "text-green-700 bg-green-50 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  : "text-muted-foreground bg-transparent border-border hover:bg-primary/5 hover:text-primary hover:border-primary/30"
              )}
            >
              {isMember ? (
                <span className="flex items-center gap-0.5"><Check className="h-2.5 w-2.5" />Miembro</span>
              ) : "+ Unirse"}
            </button>
          )}
        </div>

        {project.taskCount > 0 && (
          <ProgressBar done={project.pendingCount} total={project.taskCount} />
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            <strong className="text-foreground font-semibold">{project.pendingCount}</strong> pendientes
          </span>
          <span className="text-border">·</span>
          <span>
            <strong className="text-foreground font-semibold">{project.taskCount}</strong> total
          </span>
          {doneCount > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="text-green-600 font-medium">{doneCount} ✓</span>
            </>
          )}
        </div>
      </div>

      <Link href={`/tasks/projects/${project.id}`}>
        <div className="px-4 py-2.5 border-t border-border/50 flex items-center justify-between hover:bg-accent/20 transition-colors cursor-pointer">
          {project.members.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {visibleMembers.map(m => (
                  <Avatar key={m.personnelId} className="h-5 w-5 border border-card">
                    <AvatarFallback className={cn("text-[8px] font-bold text-white", bg)}>
                      {getInitials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {overflow > 0 && (
                  <div className="h-5 w-5 rounded-full bg-muted border border-card flex items-center justify-center">
                    <span className="text-[8px] text-muted-foreground font-medium">+{overflow}</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5" />{project.members.length}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground/50 italic flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />Sin miembros — clic para agregar
            </span>
          )}
          <span className="text-[11px] text-primary font-medium">Ver tareas →</span>
        </div>
      </Link>
    </div>
  );
}

async function fetchProjects(): Promise<TaskProject[]> {
  const res = await authFetch("/api/tasks/projects");
  if (!res.ok) {
    throw new Error(`Error ${res.status} al obtener proyectos`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inesperada del servidor");
  }
  return data;
}

export default function ProjectsHubPage() {
  const [search, setSearch] = useState("");
  const [gridMode, setGridMode] = useState<"grid" | "list">("grid");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const { user } = useAuth();

  const { data: projects = [], isLoading, isError, refetch } = useQuery<TaskProject[], Error, TaskProject[]>({
    queryKey: ["/api/tasks/projects"],
    queryFn: fetchProjects,
    retry: 2,
    staleTime: 0,
    select: (data) => Array.isArray(data) ? data : [],
  });

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => {
      if (!r.ok) throw new Error("Error al obtener personal");
      return r.json();
    }),
  });

  const joinMutation = useMutation({
    mutationFn: ({ projectId, personnelId }: { projectId: number; personnelId: number }) =>
      apiRequest(`/api/tasks/projects/${projectId}/members`, "POST", { personnelId, role: "member" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
      toast({ title: "Te uniste al proyecto" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: ({ projectId, personnelId }: { projectId: number; personnelId: number }) =>
      apiRequest(`/api/tasks/projects/${projectId}/members/${personnelId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
      toast({ title: "Saliste del proyecto" });
    },
  });

  const myPersonnel = personnel.find(p => user?.email && p.email === user.email);
  const myPersonnelId = myPersonnel?.id;

  const filtered = projects.filter(p =>
    !search ||
    (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName || "").toLowerCase().includes(search.toLowerCase())
  );

  const myProjects = filtered.filter(p => myPersonnelId && p.members.some(m => m.personnelId === myPersonnelId));
  const otherProjects = filtered.filter(p => !myPersonnelId || !p.members.some(m => m.personnelId === myPersonnelId));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="h-8 w-8 text-destructive/60" />
        <p className="text-sm text-muted-foreground">No se pudieron cargar los proyectos.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Proyectos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} proyectos · {projects.reduce((a, p) => a + p.pendingCount, 0)} tareas pendientes
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar proyecto..."
              className="pl-8 h-8 w-52 text-sm"
            />
          </div>

          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setGridMode("grid")}
              className={cn("px-2.5 py-1.5 transition-colors", gridMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setGridMode("list")}
              className={cn("px-2.5 py-1.5 transition-colors", gridMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button size="sm" className="h-8 text-sm gap-1.5" onClick={() => setNewProjectOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo proyecto
          </Button>
        </div>
      </div>

      {/* My projects */}
      {myProjects.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mis proyectos</p>
          <div className={cn(
            gridMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              : "flex flex-col gap-2"
          )}>
            {myProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                myPersonnelId={myPersonnelId}
                onJoin={() => myPersonnelId && joinMutation.mutate({ projectId: project.id, personnelId: myPersonnelId })}
                onLeave={() => myPersonnelId && leaveMutation.mutate({ projectId: project.id, personnelId: myPersonnelId })}
                joining={joinMutation.isPending}
                leaving={leaveMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other projects */}
      {otherProjects.length > 0 && (
        <div>
          {myProjects.length > 0 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Todos los proyectos</p>
          )}
          <div className={cn(
            gridMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              : "flex flex-col gap-2"
          )}>
            {otherProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                myPersonnelId={myPersonnelId}
                onJoin={() => myPersonnelId && joinMutation.mutate({ projectId: project.id, personnelId: myPersonnelId })}
                onLeave={() => myPersonnelId && leaveMutation.mutate({ projectId: project.id, personnelId: myPersonnelId })}
                joining={joinMutation.isPending}
                leaving={leaveMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Plus className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-medium text-foreground mb-1">
            {search ? "No se encontraron proyectos" : "Todavía no hay proyectos"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {search ? "Probá con otro término de búsqueda" : "Creá tu primer proyecto para empezar a organizar tareas"}
          </p>
          {!search && (
            <Button size="sm" onClick={() => setNewProjectOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Nuevo proyecto
            </Button>
          )}
        </div>
      )}

      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  );
}
