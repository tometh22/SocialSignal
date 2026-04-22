import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, X, Link2 } from "lucide-react";

type ProviderRow = {
  provider: {
    id: number;
    userId: number;
    personnelId: number | null;
    companyName: string;
    taxId: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    hourlyRate: number | null;
    hourlyRateARS: number | null;
    active: boolean;
    notes: string | null;
    createdAt: string;
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  } | null;
};

type AccessRow = {
  id: number;
  providerId: number;
  projectId: number;
  canLogHours: boolean;
  canUploadCosts: boolean;
  grantedAt: string;
};

type ActiveProjectRow = {
  id: number;
  quotationId: number;
  status: string;
};

export default function AdminProviders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingAccessFor, setEditingAccessFor] = useState<number | null>(null);

  const providersQuery = useQuery<ProviderRow[]>({
    queryKey: ["/api/admin/external-providers"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/external-providers");
      if (!res.ok) throw new Error("Error al cargar proveedores");
      return res.json();
    },
  });

  const projectsQuery = useQuery<ActiveProjectRow[]>({
    queryKey: ["/api/active-projects"],
    queryFn: async () => {
      const res = await authFetch("/api/active-projects");
      if (!res.ok) throw new Error("Error al cargar proyectos");
      return res.json();
    },
  });

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Proveedores externos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Empresas o freelancers externos con acceso a proyectos específicos.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Nuevo proveedor
        </button>
      </div>

      {showCreate && <CreateProviderForm onDone={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["/api/admin/external-providers"] }); }} />}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Empresa</th>
              <th className="px-4 py-2.5">Usuario</th>
              <th className="px-4 py-2.5 text-right">Tarifa USD</th>
              <th className="px-4 py-2.5 text-right">Tarifa ARS</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {providersQuery.isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Cargando…</td></tr>
            )}
            {providersQuery.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Todavía no hay proveedores.</td></tr>
            )}
            {(providersQuery.data ?? []).map(row => (
              <React.Fragment key={row.provider.id}>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800">{row.provider.companyName}</div>
                    {row.provider.taxId && <div className="text-[11px] text-slate-400">CUIT {row.provider.taxId}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.user ? (
                      <>
                        <div>{row.user.firstName} {row.user.lastName}</div>
                        <div className="text-[11px] text-slate-400">{row.user.email}</div>
                      </>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.provider.hourlyRate ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.provider.hourlyRateARS ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] rounded-full px-2 py-0.5 ${row.provider.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {row.provider.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => setEditingAccessFor(editingAccessFor === row.provider.id ? null : row.provider.id)}
                      className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline text-xs"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {editingAccessFor === row.provider.id ? "Ocultar" : "Proyectos"}
                    </button>
                  </td>
                </tr>
                {editingAccessFor === row.provider.id && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50 px-4 py-4">
                      <ProviderAccessEditor providerId={row.provider.id} projects={projectsQuery.data ?? []} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateProviderForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    firstName: "", lastName: "", email: "", password: "",
    companyName: "", taxId: "", contactPhone: "",
    hourlyRate: "", hourlyRateARS: "",
  });

  const m = useMutation({
    mutationFn: async () => {
      const payload: any = { ...f };
      payload.hourlyRate = f.hourlyRate ? Number(f.hourlyRate) : null;
      payload.hourlyRateARS = f.hourlyRateARS ? Number(f.hourlyRateARS) : null;
      const res = await authFetch("/api/admin/external-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Error al crear proveedor");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Proveedor creado" });
      onDone();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Nuevo proveedor</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Input label="Nombre" value={f.firstName} onChange={v => setF({ ...f, firstName: v })} />
        <Input label="Apellido" value={f.lastName} onChange={v => setF({ ...f, lastName: v })} />
        <Input label="Email (login)" value={f.email} onChange={v => setF({ ...f, email: v })} />
        <Input label="Contraseña temporal" value={f.password} onChange={v => setF({ ...f, password: v })} type="password" />
        <Input label="Empresa" value={f.companyName} onChange={v => setF({ ...f, companyName: v })} />
        <Input label="CUIT" value={f.taxId} onChange={v => setF({ ...f, taxId: v })} />
        <Input label="Teléfono" value={f.contactPhone} onChange={v => setF({ ...f, contactPhone: v })} />
        <Input label="Tarifa hora USD" value={f.hourlyRate} onChange={v => setF({ ...f, hourlyRate: v })} type="number" />
        <Input label="Tarifa hora ARS" value={f.hourlyRateARS} onChange={v => setF({ ...f, hourlyRateARS: v })} type="number" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending || !f.firstName || !f.lastName || !f.email || !f.password || !f.companyName}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {m.isPending ? "Creando…" : "Crear proveedor"}
        </button>
        <button onClick={onDone} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </label>
  );
}

function ProviderAccessEditor({ providerId, projects }: { providerId: number; projects: ActiveProjectRow[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [projectIdToAdd, setProjectIdToAdd] = useState<string>("");

  const accessQuery = useQuery<AccessRow[]>({
    queryKey: ["/api/admin/external-providers", providerId, "access"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/external-providers/${providerId}/access`);
      if (!res.ok) throw new Error("Error al cargar accesos");
      return res.json();
    },
  });

  const assignM = useMutation({
    mutationFn: async () => {
      if (!projectIdToAdd) throw new Error("Elegí un proyecto");
      const res = await authFetch(`/api/admin/external-providers/${providerId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectIdToAdd), canLogHours: true, canUploadCosts: true }),
      });
      if (!res.ok) throw new Error("Error al asignar");
      return res.json();
    },
    onSuccess: () => {
      setProjectIdToAdd("");
      qc.invalidateQueries({ queryKey: ["/api/admin/external-providers", providerId, "access"] });
      toast({ title: "Proyecto asignado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeM = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await authFetch(`/api/admin/external-providers/${providerId}/access/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al revocar");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/external-providers", providerId, "access"] });
      toast({ title: "Acceso revocado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignedIds = useMemo(() => new Set((accessQuery.data ?? []).map(a => a.projectId)), [accessQuery.data]);
  const available = useMemo(() => projects.filter(p => !assignedIds.has(p.id)), [projects, assignedIds]);

  return (
    <div>
      <div className="flex gap-2 items-center mb-3">
        <select
          value={projectIdToAdd}
          onChange={e => setProjectIdToAdd(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Elegí un proyecto…</option>
          {available.map(p => (
            <option key={p.id} value={p.id}>#{p.id} — quotation {p.quotationId} ({p.status})</option>
          ))}
        </select>
        <button
          onClick={() => assignM.mutate()}
          disabled={!projectIdToAdd || assignM.isPending}
          className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          Asignar
        </button>
      </div>
      <ul className="space-y-1">
        {(accessQuery.data ?? []).length === 0 && (
          <li className="text-xs text-slate-400">Sin proyectos asignados.</li>
        )}
        {(accessQuery.data ?? []).map(a => (
          <li key={a.id} className="flex items-center justify-between rounded-md bg-white border border-slate-200 px-3 py-1.5 text-sm">
            <span>Proyecto #{a.projectId}</span>
            <span className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">{a.canLogHours ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />} horas</span>
              <span className="flex items-center gap-1">{a.canUploadCosts ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-slate-400" />} costos</span>
              <button onClick={() => revokeM.mutate(a.projectId)} className="text-rose-600 hover:text-rose-700" title="Revocar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
