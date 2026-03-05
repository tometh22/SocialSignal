import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, Check, Users, LayoutGrid, List, AlertCircle, BarChart2, CheckCircle2, Clock, ListTodo, TrendingUp, ArrowRight } from "lucide-react";
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

// ─── General Panel ──────────────────────────────────────────────────────────

function GeneralPanel({ projects }: { projects: TaskProject[] }) {
  const totalTasks = projects.reduce((s, p) => s + p.taskCount, 0);
  const totalPending = projects.reduce((s, p) => s + p.pendingCount, 0);
  const totalDone = totalTasks - totalPending;
  const overallPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  // Projects sorted by completion desc
  const byCompletion = [...projects]
    .filter(p => p.taskCount > 0)
    .sort((a, b) => {
      const pctA = (a.taskCount - a.pendingCount) / a.taskCount;
      const pctB = (b.taskCount - b.pendingCount) / b.taskCount;
      return pctB - pctA;
    });

  // Projects with most pending (top issues)
  const byPending = [...projects]
    .filter(p => p.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount)
    .slice(0, 5);

  // Projects with no tasks
  const emptyProjects = projects.filter(p => p.taskCount === 0);

  // Member frequency across all projects
  const memberFreq: Record<string, { name: string; projects: number; roles: Set<string> }> = {};
  projects.forEach(p => {
    p.members.forEach(m => {
      if (!memberFreq[m.personnelId]) {
        memberFreq[m.personnelId] = { name: m.name, projects: 0, roles: new Set() };
      }
      memberFreq[m.personnelId].projects += 1;
      memberFreq[m.personnelId].roles.add(m.role);
    });
  });
  const topMembers = Object.entries(memberFreq)
    .sort((a, b) => b[1].projects - a[1].projects)
    .slice(0, 8);

  const maxPending = byPending[0]?.pendingCount || 1;

  return (
    <div className="space-y-6 mt-2">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: ListTodo, label: "Proyectos activos", value: projects.length, color: "bg-indigo-500" },
          { icon: Clock, label: "Tareas pendientes", value: totalPending, color: "bg-amber-500" },
          { icon: CheckCircle2, label: "Completadas", value: totalDone, color: "bg-green-500" },
          { icon: TrendingUp, label: "Avance general", value: `${overallPct}%`, color: "bg-primary" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", card.color)}>
              <card.icon className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Global progress */}
      {totalTasks > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Avance global</h3>
            <span className="text-sm font-bold text-foreground">{overallPct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{totalDone} de {totalTasks} tareas completadas en {projects.length} proyectos</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Progress by project */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Progreso por proyecto</h3>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {byCompletion.map(p => {
              const done = p.taskCount - p.pendingCount;
              const pct = Math.round((done / p.taskCount) * 100);
              const bg = getPaletteBg(p.id);
              return (
                <Link key={p.id} href={`/tasks/projects/${p.id}`}>
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                    <span className={cn("w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold", bg)}>
                      {getProjectInitial(p)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-tight">
                        {p.name}
                      </p>
                      {p.clientName && (
                        <p className="text-[10px] text-muted-foreground truncate">{p.clientName}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", bg)} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 w-16 text-right">
                          {done}/{p.taskCount} · {pct}%
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
            {projects.filter(p => p.taskCount === 0).map(p => {
              const bg = getPaletteBg(p.id);
              return (
                <Link key={p.id} href={`/tasks/projects/${p.id}`}>
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer opacity-50">
                    <span className={cn("w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold", bg)}>
                      {getProjectInitial(p)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">Sin tareas</p>
                    </div>
                  </div>
                </Link>
              );
            })}
            {byCompletion.length === 0 && emptyProjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sin proyectos con tareas</p>
            )}
          </div>
        </div>

        {/* Top pending + team */}
        <div className="space-y-4">
          {/* Most pending */}
          {byPending.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Mayor carga pendiente</h3>
              </div>
              <div className="divide-y divide-border">
                {byPending.map(p => {
                  const bg = getPaletteBg(p.id);
                  const barW = Math.round((p.pendingCount / maxPending) * 100);
                  return (
                    <Link key={p.id} href={`/tasks/projects/${p.id}`}>
                      <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer">
                        <span className={cn("w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold", bg)}>
                          {getProjectInitial(p)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${barW}%` }} />
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-amber-600 flex-shrink-0">{p.pendingCount}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Team across projects */}
          {topMembers.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Equipo involucrado</h3>
              </div>
              <div className="px-5 py-3">
                <div className="flex flex-wrap gap-2">
                  {topMembers.map(([id, m]) => (
                    <div key={id} className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[8px] font-bold bg-primary text-primary-foreground">
                          {getInitials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-foreground">{m.name.split(" ")[0]}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">
                        {m.projects} {m.projects === 1 ? "proyecto" : "proyectos"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Projects table summary */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Resumen de todos los proyectos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground bg-muted/30 border-b border-border">
                <th className="text-left px-5 py-2.5 font-medium">Proyecto</th>
                <th className="text-center px-3 py-2.5 font-medium">Total</th>
                <th className="text-center px-3 py-2.5 font-medium">Pendientes</th>
                <th className="text-center px-3 py-2.5 font-medium">Completadas</th>
                <th className="text-center px-3 py-2.5 font-medium hidden sm:table-cell">Avance</th>
                <th className="text-center px-3 py-2.5 font-medium">Equipo</th>
                <th className="text-right px-5 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {[...projects].sort((a, b) => b.pendingCount - a.pendingCount).map((p, i) => {
                const done = p.taskCount - p.pendingCount;
                const pct = p.taskCount > 0 ? Math.round((done / p.taskCount) * 100) : 0;
                const bg = getPaletteBg(p.id);
                return (
                  <tr key={p.id} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold", bg)}>
                          {getProjectInitial(p)}
                        </span>
                        <div>
                          <p className="font-medium text-foreground text-sm leading-tight">{p.name}</p>
                          {p.clientName && <p className="text-[10px] text-muted-foreground">{p.clientName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-foreground">{p.taskCount}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("font-medium", p.pendingCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
                        {p.pendingCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-green-600 font-medium">{done}</span>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center -space-x-1">
                        {p.members.slice(0, 3).map(m => (
                          <Avatar key={m.personnelId} className="h-5 w-5 border border-card">
                            <AvatarFallback className={cn("text-[8px] font-bold text-white", bg)}>
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {p.members.length > 3 && (
                          <div className="h-5 w-5 rounded-full bg-muted border border-card flex items-center justify-center">
                            <span className="text-[8px] text-muted-foreground">+{p.members.length - 3}</span>
                          </div>
                        )}
                        {p.members.length === 0 && <span className="text-[11px] text-muted-foreground/50">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/tasks/projects/${p.id}`}>
                        <Button variant="ghost" size="sm" className="h-6 text-xs">
                          Ver →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Data Fetch ──────────────────────────────────────────────────────────────

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjectsHubPage() {
  const [search, setSearch] = useState("");
  const [gridMode, setGridMode] = useState<"grid" | "list">("grid");
  const [view, setView] = useState<"projects" | "panel">("projects");
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
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Proyectos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} proyectos · {projects.reduce((a, p) => a + p.pendingCount, 0)} tareas pendientes
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {view === "projects" && (
            <>
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
            </>
          )}

          <Button size="sm" className="h-8 text-sm gap-1.5" onClick={() => setNewProjectOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo proyecto
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border -mt-2">
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
            view === "projects"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setView("projects")}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Proyectos
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
          Panel general
        </button>
      </div>

      {/* Panel general */}
      {view === "panel" && <GeneralPanel projects={projects} />}

      {/* Project list / grid */}
      {view === "projects" && (
        <>
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
        </>
      )}

      <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  );
}
