import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Clock, DollarSign } from "lucide-react";

type InvoiceRow = {
  id: number;
  period: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  computedTotalCostARS: number | null;
  computedTotalCostUSD: number | null;
  hoursTotal: number | null;
  notes: string | null;
  uploadedAt: string;
  updatedAt: string;
};

type MonthSummary = {
  period: string;
  userId: number;
  personnelId: number | null;
  hours: number;
  totalCostARS: number;
  totalCostUSD: number;
  entryCount: number;
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatARS(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function formatPeriodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export default function MyInvoices() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const invoicesQuery = useQuery<InvoiceRow[]>({
    queryKey: ["/api/me/invoices"],
    queryFn: async () => {
      const res = await authFetch("/api/me/invoices");
      if (!res.ok) throw new Error("Error al cargar facturas");
      return res.json();
    },
  });

  const summaryQuery = useQuery<MonthSummary>({
    queryKey: ["/api/me/invoices/summary", period],
    queryFn: async () => {
      const res = await authFetch(`/api/me/invoices/summary?period=${period}`);
      if (!res.ok) throw new Error("Error al cargar resumen");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Seleccioná un archivo");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("period", period);
      if (notes) fd.append("notes", notes);
      const res = await authFetch("/api/me/invoices", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Error al subir factura");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Factura guardada", description: `Se subió la factura de ${formatPeriodLabel(period)}.` });
      setFile(null);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["/api/me/invoices"] });
    },
    onError: (err: Error) => {
      toast({ title: "No se pudo subir", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/me/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al borrar factura");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Factura borrada" });
      qc.invalidateQueries({ queryKey: ["/api/me/invoices"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error al borrar", description: err.message, variant: "destructive" });
    },
  });

  const existingForPeriod = useMemo(
    () => (invoicesQuery.data ?? []).find(i => i.period === period) ?? null,
    [invoicesQuery.data, period]
  );

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Mis facturas</h1>
      <p className="text-sm text-slate-500 mb-6">
        Subí la factura de cada mes. Solo vos la ves. El total sugerido se calcula desde tus horas cargadas.
      </p>

      {/* Hero: resumen del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Clock className="h-3.5 w-3.5" /> Horas del mes
          </div>
          <div className="text-2xl font-semibold text-slate-800 tabular-nums">
            {summaryQuery.data ? summaryQuery.data.hours.toFixed(2) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <DollarSign className="h-3.5 w-3.5" /> Total calculado (ARS)
          </div>
          <div className="text-2xl font-semibold text-emerald-700 tabular-nums">
            {summaryQuery.data ? formatARS(summaryQuery.data.totalCostARS) : "—"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summaryQuery.data?.entryCount ?? 0} registros cargados
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">Período</div>
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="text-[11px] text-slate-400 mt-1 capitalize">{formatPeriodLabel(period)}</div>
        </div>
      </div>

      {/* Upload form */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          {existingForPeriod ? "Reemplazar factura de este mes" : "Subir factura del mes"}
        </h2>
        {existingForPeriod && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Ya tenés una factura cargada para {formatPeriodLabel(period)} (<a className="underline" href={existingForPeriod.fileUrl} target="_blank" rel="noreferrer">{existingForPeriod.fileName}</a>).
            Si subís un archivo nuevo, se reemplaza.
          </div>
        )}
        <div className="space-y-3">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
          />
          <textarea
            placeholder="Notas opcionales (número de factura, concepto…)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? "Subiendo…" : existingForPeriod ? "Reemplazar factura" : "Subir factura"}
          </button>
        </div>
      </div>

      {/* Historial */}
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Historial</h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Mes</th>
              <th className="px-4 py-2.5 text-right">Horas</th>
              <th className="px-4 py-2.5 text-right">Total calculado</th>
              <th className="px-4 py-2.5">Archivo</th>
              <th className="px-4 py-2.5">Subida</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {invoicesQuery.isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">Cargando…</td></tr>
            )}
            {invoicesQuery.data && invoicesQuery.data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">Todavía no subiste ninguna factura.</td></tr>
            )}
            {(invoicesQuery.data ?? []).map(row => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 capitalize">{formatPeriodLabel(row.period)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.hoursTotal?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatARS(row.computedTotalCostARS)}</td>
                <td className="px-4 py-2.5">
                  <a href={row.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline">
                    <FileText className="h-3.5 w-3.5" />
                    {row.fileName}
                  </a>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{formatDate(row.uploadedAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => { if (confirm("¿Borrar esta factura?")) deleteMutation.mutate(row.id); }}
                    className="text-rose-600 hover:text-rose-700"
                    title="Borrar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
