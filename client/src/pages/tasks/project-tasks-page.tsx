import { useState } from "react";
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
import { Loader2, Users, Trash2, Plus, ChevronRight, List, LayoutGrid, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import ProjectTaskList from "@/components/tasks/ProjectTaskList";

type ProjectMember = { personnelId: number; name: string; role: string };
type TaskProject = {
  id: number;
  name: string;
  clientName: string;
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
  const [view, setView] = useState<"list" | "board">("list");

  const { data: project, isLoading } = useQuery<TaskProject>({
    queryKey: ["/api/tasks/projects", projectId],
    queryFn: () => authFetch(`/api/tasks/projects/${projectId}`).then(r => r.json()),
    enabled: !!projectId,
  });

  const { data: allPersonnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ personnelId, role }: { personnelId: number; role: string }) =>
      apiRequest(`/api/tasks/projects/${projectId}/members`, "POST", { personnelId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
      setAddPersonnelId("none");
      toast({ title: "Miembro agregado" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (personnelId: number) =>
      apiRequest(`/api/tasks/projects/${projectId}/members/${personnelId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
      toast({ title: "Miembro quitado" });
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
  const currentMemberIds = (project.members || []).map(m => m.personnelId);
  const availablePersonnel = allPersonnel.filter(p => !currentMemberIds.includes(p.id));
  const visibleMembers = (project.members || []).slice(0, 6);
  const extraMembers = (project.members || []).length - 6;

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
            <span className="text-foreground font-medium">{project.clientName} · {project.name}</span>
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
                  {project.clientName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground truncate">{project.name}</h1>
                    <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50 flex-shrink-0">
                      Activo
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.clientName}</p>
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
            </div>
          </div>
        </div>

        {/* Task list / board */}
        <div className="pt-4">
          <ProjectTaskList projectId={projectId} projectMembers={project.members || []} view={view} />
        </div>
      </div>

      {/* Members management sheet */}
      <Sheet open={membersOpen} onOpenChange={setMembersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Miembros del proyecto
            </SheetTitle>
            <p className="text-sm text-muted-foreground">{project.clientName} · {project.name}</p>
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
                Miembros actuales ({(project.members || []).length})
              </p>
              {(project.members || []).length === 0 && (
                <p className="text-sm text-muted-foreground italic py-2">Sin miembros todavía</p>
              )}
              {(project.members || []).map(m => (
                <div key={m.personnelId} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-accent/40 hover:bg-accent/60 transition-colors group">
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
