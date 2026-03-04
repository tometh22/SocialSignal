import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, authFetch } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

const PALETTE = [
  { label: "Azul", bg: "bg-blue-500", ring: "ring-blue-500" },
  { label: "Violeta", bg: "bg-purple-500", ring: "ring-purple-500" },
  { label: "Verde", bg: "bg-green-500", ring: "ring-green-500" },
  { label: "Naranja", bg: "bg-orange-500", ring: "ring-orange-500" },
  { label: "Rosa", bg: "bg-pink-500", ring: "ring-pink-500" },
  { label: "Teal", bg: "bg-teal-500", ring: "ring-teal-500" },
  { label: "Índigo", bg: "bg-indigo-500", ring: "ring-indigo-500" },
  { label: "Rojo", bg: "bg-rose-500", ring: "ring-rose-500" },
];

type ActiveProject = { id: number; name: string; clientName: string };
type Personnel = { id: number; name: string; email?: string | null };

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NewProjectDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [name, setName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [privacy, setPrivacy] = useState<"team" | "private">("team");
  const [activeProjectId, setActiveProjectId] = useState<string>("none");

  const { data: taskProjectsRaw } = useQuery<any[]>({
    queryKey: ["/api/tasks/projects"],
    queryFn: () => authFetch("/api/tasks/projects").then(r => r.json()),
    enabled: open,
  });
  const taskProjects = Array.isArray(taskProjectsRaw) ? taskProjectsRaw : [];
  const activeProjects = taskProjects.filter((p: any) => p.source === 'active_project' || !p.source);

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ["/api/tasks-personnel"],
    queryFn: () => authFetch("/api/tasks-personnel").then(r => r.json()),
    enabled: open,
  });

  const myPersonnel = personnel.find(p => user?.email && p.email === user.email);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks/projects/create", "POST", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/projects"] });
      toast({ title: "Proyecto creado" });
      onClose();
      resetForm();
      if (data?.id) {
        navigate(`/tasks/projects/${data.id}`);
      }
    },
    onError: () => {
      toast({ title: "Error al crear proyecto", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setColorIndex(0);
    setPrivacy("team");
    setActiveProjectId("none");
  };

  const handleCreate = () => {
    if (activeProjectId !== "none") {
      createMutation.mutate({
        activeProjectId: parseInt(activeProjectId),
        personnelId: myPersonnel?.id,
        colorIndex,
        privacy,
      });
    } else {
      if (!name.trim()) return;
      createMutation.mutate({
        name: name.trim(),
        colorIndex,
        privacy,
        personnelId: myPersonnel?.id,
      });
    }
  };

  const isValid = activeProjectId !== "none" || name.trim().length > 0;
  const selectedPalette = PALETTE[colorIndex] || PALETTE[0];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className={cn("inline-flex w-8 h-8 rounded-lg items-center justify-center text-white font-bold text-sm flex-shrink-0", selectedPalette.bg)}>
              {name.charAt(0).toUpperCase() || "P"}
            </span>
            Nuevo proyecto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Project name */}
          <div className="space-y-1.5">
            <Label htmlFor="proj-name" className="text-sm font-medium">Nombre del proyecto</Label>
            <Input
              id="proj-name"
              placeholder="Ej: Campaña redes sociales"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={activeProjectId !== "none"}
              className={cn(activeProjectId !== "none" && "opacity-40")}
            />
          </div>

          {/* Link to active project */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Vincular a proyecto de cliente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select value={activeProjectId} onValueChange={setActiveProjectId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Sin proyecto base" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proyecto base</SelectItem>
                {activeProjects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    <span className="font-medium">{p.clientName || "—"}</span>
                    <span className="text-muted-foreground ml-1.5">· {p.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Si elegís un proyecto de cliente, el nombre y las tareas se vinculan a ese proyecto.</p>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PALETTE.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setColorIndex(i)}
                  className={cn(
                    "w-7 h-7 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95",
                    c.bg,
                    colorIndex === i && `ring-2 ring-offset-2 ${c.ring}`
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Visibilidad</Label>
            <RadioGroup value={privacy} onValueChange={v => setPrivacy(v as "team" | "private")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="team" id="priv-team" />
                <Label htmlFor="priv-team" className="text-sm font-normal cursor-pointer">Compartido con el equipo</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="private" id="priv-private" />
                <Label htmlFor="priv-private" className="text-sm font-normal cursor-pointer">Solo yo</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onClose(); resetForm(); }}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || createMutation.isPending}
            className="min-w-[100px]"
          >
            {createMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : "Crear proyecto"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
