import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Briefcase, Clock, Receipt, Upload, Plus, X } from "lucide-react";

type ProviderProject = {
  id: number;
  status: string;
  isFinished: boolean | null;
  closedAt: string | null;
  access: {
    canLogHours: boolean;
    canUploadCosts: boolean;
  };
};

type ProviderMe = {
  provider: { id: number; userId: number; companyName: string };
  accesses: Array<{ projectId: number; canLogHours: boolean; canUploadCosts: boolean }>;
  projects: ProviderProject[];
};

export default function ProviderDashboard() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  const meQuery = useQuery<ProviderMe>({
    queryKey: ["/api/provider/me"],
    queryFn: async () => {
      const res = await authFetch("/api/provider/me");
      if (!res.ok) throw new Error("Error al cargar perfil");
      return res.json();
    },
  });

  const projectsQuery = useQuery<ProviderProject[]>({
    queryKey: ["/api/provider/projects"],
    queryFn: async () => {
      const res = await authFetch("/api/provider/projects");
      if (!res.ok) throw new Error("Error al cargar proyectos");
      return res.json();
    },
  });

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">
        Panel — {meQuery.data?.provider.companyName ?? "Proveedor"}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Cargá tus horas en los proyectos donde tenés acceso y subí tu factura mensual.
      </p>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link href="/my-invoices">
          <a className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
            <Receipt className="h-5 w-5 text-indigo-600 mb-2" />
            <div className="font-medium text-slate-800">Mis facturas</div>
            <div className="text-xs text-slate-500 mt-0.5">Subí la factura del mes</div>
          </a>
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Briefcase className="h-5 w-5 text-emerald-600 mb-2" />
          <div className="font-medium text-slate-800">Proyectos asignados</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {projectsQuery.data?.length ?? 0} proyecto{(projectsQuery.data?.length ?? 0) === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Projects list */}
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Tus proyectos</h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {projectsQuery.isLoading && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">Cargando…</div>
        )}
        {projectsQuery.data?.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">
            No tenés proyectos asignados. Pedile al administrador que te agregue.
          </div>
        )}
        <ul>
          {(projectsQuery.data ?? []).map(p => {
            const closed = p.isFinished || p.closedAt;
            return (
              <li key={p.id} className="border-t border-slate-100 first:border-t-0 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">Proyecto #{p.id}</div>
                  <div className="text-[11px] text-slate-500">
                    Estado: {p.status}{closed ? " · cerrado" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.access.canLogHours && !closed && (
                    <button
                      onClick={() => setSelectedProject(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs hover:bg-emerald-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Cargar horas
                    </button>
                  )}
                  {closed && (
                    <span className="text-[11px] text-slate-400">Cerrado, no admite cambios</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {selectedProject !== null && (
        <TimeEntryModal
          projectId={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}

function TimeEntryModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/provider/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, date, hours: Number(hours), description }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Error al cargar hora");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Horas cargadas" });
      qc.invalidateQueries({ queryKey: ["/api/provider/projects"] });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Cargar horas — Proyecto #{projectId}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Fecha</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Horas</span>
            <input type="number" step="0.25" min="0.25" value={hours} onChange={e => setHours(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Descripción</span>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          </label>
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => m.mutate()}
            disabled={!hours || m.isPending}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {m.isPending ? "Guardando…" : "Guardar horas"}
          </button>
        </div>
      </div>
    </div>
  );
}
