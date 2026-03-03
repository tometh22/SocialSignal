import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SECTION_LABELS, ALL_SECTIONS, AppSection } from "@/hooks/use-permissions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Pencil, UserX, UserCheck, ShieldCheck, Shield } from "lucide-react";

type UserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
};

const SECTION_COLORS: Record<AppSection, string> = {
  dashboard: "bg-blue-100 text-blue-700",
  crm: "bg-purple-100 text-purple-700",
  quotations: "bg-amber-100 text-amber-700",
  projects: "bg-green-100 text-green-700",
  finance: "bg-rose-100 text-rose-700",
  admin: "bg-gray-100 text-gray-700",
};

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  isAdmin: boolean;
  permissions: string[];
};

const emptyForm: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  isAdmin: false,
  permissions: [],
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: users = [], isLoading } = useQuery<UserRecord[]>({
    queryKey: ["/api/admin/users"],
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/admin/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setModalOpen(false);
      setForm(emptyForm);
      toast({ title: "Usuario creado correctamente" });
    },
    onError: async (error: any) => {
      const msg = error?.message || "Error al crear usuario";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormData> }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setModalOpen(false);
      setEditingUser(null);
      setForm(emptyForm);
      toast({ title: "Usuario actualizado correctamente" });
    },
    onError: async (error: any) => {
      const msg = error?.message || "Error al actualizar usuario";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, { isActive }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: vars.isActive ? "Usuario activado" : "Usuario desactivado" });
    },
    onError: async (error: any) => {
      const msg = error?.message || "Error al cambiar estado";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
      isAdmin: user.isAdmin,
      permissions: user.permissions || [],
    });
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (editingUser) {
      const data: any = { ...form };
      if (!data.password) delete data.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(form);
    }
  };

  const togglePermission = (section: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(section)
        ? prev.permissions.filter(p => p !== section)
        : [...prev.permissions, section],
    }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
          <p className="text-muted-foreground mt-1">
            Administrá los usuarios y sus permisos de acceso a cada sección del sistema.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usuarios del sistema</CardTitle>
          <CardDescription>
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={!user.isActive ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.firstName} {user.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge className="bg-primary/10 text-primary border-0 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Acceso total
                        </Badge>
                      ) : user.permissions?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.permissions.map((p) => (
                            <span
                              key={p}
                              className={`inline-flex text-xs px-1.5 py-0.5 rounded font-medium ${SECTION_COLORS[p as AppSection] || "bg-gray-100 text-gray-700"}`}
                            >
                              {SECTION_LABELS[p as AppSection] || p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin permisos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isAdmin ? "default" : "outline"} className="gap-1 text-xs">
                        {user.isAdmin ? <><ShieldCheck className="h-3 w-3" /> Admin</> : <><Shield className="h-3 w-3" /> Usuario</>}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={user.isActive ? "border-green-500 text-green-600" : "border-gray-300 text-gray-400"}
                      >
                        {user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => openEdit(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 gap-1 text-xs ${user.isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-700"}`}
                          onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })}
                          disabled={toggleActiveMutation.isPending}
                        >
                          {user.isActive
                            ? <><UserX className="h-3.5 w-3.5" /> Desactivar</>
                            : <><UserCheck className="h-3.5 w-3.5" /> Activar</>
                          }
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); setEditingUser(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuario" : "Crear nuevo usuario"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="García"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="juan@epical.digital"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">
                Contraseña {editingUser && <span className="text-muted-foreground text-xs">(dejá en blanco para no cambiar)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder={editingUser ? "••••••••" : "Mínimo 6 caracteres"}
              />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <Switch
                id="isAdmin"
                checked={form.isAdmin}
                onCheckedChange={checked => setForm(prev => ({ ...prev, isAdmin: checked }))}
              />
              <div>
                <Label htmlFor="isAdmin" className="font-medium cursor-pointer">Administrador</Label>
                <p className="text-xs text-muted-foreground">Acceso total a todas las secciones del sistema</p>
              </div>
            </div>

            {!form.isAdmin && (
              <div className="space-y-2">
                <Label>Permisos por sección</Label>
                <div className="space-y-2 rounded-lg border p-3">
                  {ALL_SECTIONS.map((section) => (
                    <div key={section} className="flex items-center gap-3">
                      <Checkbox
                        id={`perm-${section}`}
                        checked={form.permissions.includes(section)}
                        onCheckedChange={() => togglePermission(section)}
                      />
                      <label htmlFor={`perm-${section}`} className="text-sm cursor-pointer select-none flex-1">
                        <span className="font-medium">{SECTION_LABELS[section]}</span>
                      </label>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SECTION_COLORS[section]}`}>
                        {section}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); setEditingUser(null); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
