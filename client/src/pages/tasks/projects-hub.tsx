import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, CheckSquare, Users, Clock, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

type ProjectMember = { personnelId: number; name: string; role: string };
type TaskProject = {
  id: number;
  name: string;
  clientName: string;
  status: string;
  taskCount: number;
  pendingCount: number;
  lastActivity?: string;
  members: ProjectMember[];
};

type Personnel = { id: number; name: string; email?: string | null };

const PROJECT_PALETTE = [
  { bg: "bg-blue-500", light: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  { bg: "bg-purple-500", light: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  { bg: "bg-green-500", light: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  { bg: "bg-orange-500", light: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
  { bg: "bg-pink-500", light: "bg-pink-50", border: "border-pink-200", text: "text-pink-700" },
  { bg: "bg-teal-500", light: "bg-teal-50", border: "border-teal-200", text: "text-teal-700" },
  { bg: "bg-indigo-500", light: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
  { bg: "bg-rose-500", light: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
];

function getProjectPalette(id: number) {
  return PROJECT_PALETTE[id % PROJECT_PALETTE.length];
}

function getInitials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function ProjectsHubPage() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  const { data: projects = [], isLoading } = useQuery<TaskProject[]>({
    queryKey: ["/api/tasks/projects"],
    queryFn: () => authFetch("/api/tasks/projects").then(r => r.json()),
  });

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
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

  // Find current user's personnelId
  const myPersonnel = personnel.find(p =>
    user?.email && p.email === user.email
  );
  const myPersonnelId = myPersonnel?.id;

  const filtered = projects.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.clientName.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Proyectos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects.length} proyectos activos</p>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por proyecto o cliente..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Projects grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(project => {
          const palette = getProjectPalette(project.id);
          const isMember = myPersonnelId ? project.members.some(m => m.personnelId === myPersonnelId) : false;
          const visibleMembers = project.members.slice(0, 5);
          const overflowCount = project.members.length - 5;

          return (
            <div
              key={project.id}
              className={cn(
                "bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all duration-200 group",
                palette.border
              )}
            >
              {/* Top color strip */}
              <div className={cn("h-1.5", palette.bg)} />

              <div className="p-4 flex-1 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("inline-block w-3 h-3 rounded-full flex-shrink-0", palette.bg)} />
                    <div className="min-w-0">
                      <Link href={`/tasks/projects/${project.id}`}>
                        <h3 className="font-semibold text-sm text-foreground truncate hover:text-primary transition-colors cursor-pointer">
                          {project.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">{project.clientName}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 flex-shrink-0 text-green-700 border-green-300 bg-green-50">
                    Activo
                  </Badge>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span><strong className="text-foreground">{project.pendingCount}</strong> pendientes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckSquare className="h-3.5 w-3.5 opacity-40" />
                    <span>{project.taskCount} total</span>
                  </div>
                </div>

                {/* Members row */}
                <div className="flex items-center justify-between">
                  {project.members.length > 0 ? (
                    <div className="flex items-center gap-1">
                      <div className="flex -space-x-1.5">
                        {visibleMembers.map(m => (
                          <Avatar key={m.personnelId} className="h-6 w-6 border-2 border-card">
                            <AvatarFallback className={cn("text-[9px] font-semibold text-white", palette.bg)}>
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {overflowCount > 0 && (
                          <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                            <span className="text-[9px] text-muted-foreground font-medium">+{overflowCount}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ml-1.5">
                        <Users className="h-3 w-3 inline mr-0.5" />
                        {project.members.length}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sin miembros</span>
                  )}

                  {myPersonnelId && (
                    isMember ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-green-700 hover:text-red-600 hover:bg-red-50 px-2"
                        onClick={() => leaveMutation.mutate({ projectId: project.id, personnelId: myPersonnelId })}
                        disabled={leaveMutation.isPending}
                      >
                        ✓ Miembro
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() => joinMutation.mutate({ projectId: project.id, personnelId: myPersonnelId })}
                        disabled={joinMutation.isPending}
                      >
                        + Unirse
                      </Button>
                    )
                  )}
                </div>
              </div>

              {/* Footer link */}
              <Link href={`/tasks/projects/${project.id}`}>
                <div className={cn(
                  "px-4 py-2 border-t text-xs font-medium transition-colors cursor-pointer",
                  palette.light, palette.text,
                  "hover:brightness-95"
                )}>
                  Ver tareas del proyecto →
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No se encontraron proyectos</p>
        </div>
      )}
    </div>
  );
}
