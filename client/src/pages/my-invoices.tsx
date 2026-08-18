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
  suggestedInvoiceUSD?: number | null;
  declaredInvoiceUSD?: number | null;
  bankFx?: number | null;
  differenceUSD?: number | null;
  approvalStatus?: "pending" | "approved" | "rejected";
};

type MonthSummary = {
  period: string;
  userId: number;
  personnelId: number | null;
  hours: number;
  totalCostARS: number;
  totalCostUSD: number;
  grandTotalARS?: number;
  grandTotalUSD?: number;
  fxUsd?: number;
  fxArs?: number;
  opsFxRate?: number;
  billingCurrency?: string;
  usdFraction?: number;
  isClosed?: boolean;
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

function formatUSD(n: number | null | undefined): string {
  if (n == null || !isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
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
  const [declaredInvoiceUSD, setDeclaredInvoiceUSD] = useState("");
  const [bankFx, setBankFx] = useState("");

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

  // TC propio de la persona (de su banco). Se inicializa desde el resumen.
  const [fxUsdInput, setFxUsdInput] = useState<string>("");
  const [fxArsInput, setFxArsInput] = useState<string>("");
  React.useEffect(() => {
    setFxUsdInput(summaryQuery.data?.fxUsd != null ? String(summaryQuery.data.fxUsd) : "");
    setFxArsInput(summaryQuery.data?.fxArs != null ? String(summaryQuery.data.fxArs) : "");
  }, [period, summaryQuery.data?.fxUsd, summaryQuery.data?.fxArs]);

  const fxMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/me/invoices/fx", {
        method: "PUT",
        body: JSON.stringify({
          period,
          fxUsd: fxUsdInput.trim() === "" ? null : Number(fxUsdInput),
          fxArs: fxArsInput.trim() === "" ? null : Number(fxArsInput),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Error al guardar TC");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "TC guardado", description: "Se recalculó tu total con tu tipo de cambio." });
      qc.invalidateQueries({ queryKey: ["/api/me/invoices/summary", period] });
    },
    onError: (err: Error) => {
      toast({ title: "No se pudo guardar el TC", description: err.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Seleccioná un archivo");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("period", period);
      if (notes) fd.append("notes", notes);
      if (declaredInvoiceUSD.trim()) fd.append("declaredInvoiceUSD", declaredInvoiceUSD);
      if (bankFx.trim()) fd.append("bankFx", bankFx);
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

  React.useEffect(() => {
    setDeclaredInvoiceUSD(existingForPeriod?.declaredInvoiceUSD == null ? "" : String(existingForPeriod.declaredInvoiceUSD));
    setBankFx(existingForPeriod?.bankFx == null ? "" : String(existingForPeriod.bankFx));
  }, [existingForPeriod?.id, existingForPeriod?.declaredInvoiceUSD, existingForPeriod?.bankFx]);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!existingForPeriod) throw new Error("Primero subí la factura del período");
      const response = await authFetch(`/api/me/invoices/${existingForPeriod.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          declaredInvoiceUSD: declaredInvoiceUSD.trim() === "" ? null : Number(declaredInvoiceUSD),
          bankFx: bankFx.trim() === "" ? null : Number(bankFx),
        }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message ?? "No se pudo enviar la revisión");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Revisión enviada", description: "Operaciones recibirá la factura para aprobarla." });
      qc.invalidateQueries({ queryKey: ["/api/me/invoices"] });
    },
    onError: (error: Error) => toast({ title: "No se pudo enviar", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Mis facturas</h1>
      <p className="text-sm text-slate-500 mb-6">
        Subí la factura de cada mes. Solo vos la ves. El total sugerido se calcula desde tus horas cargadas;
        compará con tus horas disponibles del mes (días hábiles sin feriados) para detectar horas no cargadas.
      </p>

      {summaryQuery.data?.isClosed && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs text-emerald-700">
          Mes cerrado en Cierre Mensual — estos valores ya son definitivos
        </div>
      )}

      {/* Hero: resumen del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Clock className="h-3.5 w-3.5" /> Horas del mes
          </div>
          <div className="text-2xl font-semibold text-slate-800 tabular-nums">
            {summaryQuery.data ? summaryQuery.data.hours.toFixed(2) : "—"}
            {(summaryQuery.data as any)?.availableHours > 0 && (
              <span className="text-sm font-normal text-slate-400"> / {(summaryQuery.data as any).availableHours}h</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summaryQuery.data?.entryCount ?? 0} registros
            {(summaryQuery.data as any)?.availableHours > 0 && (
              <> · {Math.round((summaryQuery.data!.hours / (summaryQuery.data as any).availableHours) * 100)}% de disponibles</>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            {summaryQuery.data?.billingCurrency === 'mixed'
              ? `ARS (${Math.round((1 - (summaryQuery.data?.usdFraction ?? 0)) * 100)}%)`
              : "Total (ARS)"}
          </div>
          <div className="text-2xl font-semibold text-emerald-700 tabular-nums">
            {summaryQuery.data ? formatARS(summaryQuery.data.totalCostARS) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            {summaryQuery.data?.billingCurrency === 'mixed'
              ? `USD (${Math.round((summaryQuery.data?.usdFraction ?? 0) * 100)}%)`
              : "Total (USD)"}
          </div>
          <div className="text-2xl font-semibold text-blue-700 tabular-nums">
            {summaryQuery.data ? formatUSD(summaryQuery.data.totalCostUSD) : "—"}
          </div>
          {summaryQuery.data?.billingCurrency === 'USD' && (
            <div className="text-[11px] text-blue-400 mt-1">Tarifa USD directa</div>
          )}
          {summaryQuery.data?.billingCurrency === 'mixed' && (
            <div className="text-[11px] text-blue-400 mt-1">Facturación mixta</div>
          )}
          {summaryQuery.data?.billingCurrency === 'ARS' && summaryQuery.data?.totalCostUSD === 0 && (
            <div className="text-[11px] text-slate-400 mt-1">Sin TC del mes</div>
          )}
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

      {/* TC propio de la persona (de su banco). No depende de Operaciones. */}
      {summaryQuery.data && summaryQuery.data.personnelId != null && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Tu tipo de cambio</h2>
          <p className="text-xs text-slate-500 mb-3">
            Usá el TC de tu banco para valuar tu factura. No depende del TC de Operaciones.
            {summaryQuery.data.opsFxRate ? (
              <> TC de referencia de Operaciones: <span className="tabular-nums">{summaryQuery.data.opsFxRate.toLocaleString("es-AR")}</span>.</>
            ) : null}
          </p>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                {summaryQuery.data.billingCurrency === 'mixed'
                  ? "TC tramo USD (ARS por USD)"
                  : summaryQuery.data.billingCurrency === 'USD'
                    ? "TC para valuar en ARS (ARS por USD)"
                    : "Tu TC (ARS por USD)"}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={fxUsdInput}
                disabled={summaryQuery.data.isClosed}
                onChange={e => setFxUsdInput(e.target.value)}
                placeholder={summaryQuery.data.opsFxRate ? String(summaryQuery.data.opsFxRate) : "1445"}
                className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
              />
            </div>

            {summaryQuery.data.billingCurrency === 'mixed' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">TC tramo ARS (ARS por USD)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={fxArsInput}
                  disabled={summaryQuery.data.isClosed}
                  onChange={e => setFxArsInput(e.target.value)}
                  placeholder={summaryQuery.data.opsFxRate ? String(summaryQuery.data.opsFxRate) : "1445"}
                  className="w-40 rounded-lg border border-slate-200 px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
                />
              </div>
            )}

            {!summaryQuery.data.isClosed && (
              <button
                onClick={() => fxMutation.mutate()}
                disabled={fxMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {fxMutation.isPending ? "Guardando…" : "Guardar TC"}
              </button>
            )}
          </div>

          {/* Total unificado con el TC propio */}
          {(summaryQuery.data.grandTotalARS != null || summaryQuery.data.grandTotalUSD != null) && (
            <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-3 text-sm">
              <div>
                <div className="text-[11px] text-slate-500">Total unificado (ARS)</div>
                <div className="font-semibold text-emerald-700 tabular-nums">{formatARS(summaryQuery.data.grandTotalARS)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Total unificado (USD)</div>
                <div className="font-semibold text-blue-700 tabular-nums">{formatUSD(summaryQuery.data.grandTotalUSD)}</div>
              </div>
              {summaryQuery.data.billingCurrency === 'mixed' && (
                <div className="text-[11px] text-slate-400 self-end">
                  Suma el tramo USD y el tramo ARS valuados con tus TC.
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

      {summaryQuery.data?.isClosed && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 mb-8">
          <h2 className="text-sm font-semibold text-indigo-900 mb-1">Revisión post-cierre</h2>
          <p className="text-xs text-indigo-800/80 mb-4">
            El monto sugerido para facturar es el 90% del total unificado del cierre. El cierre de Operaciones no se modifica.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div>
              <div className="text-[11px] text-indigo-700">Sugerido (90%)</div>
              <div className="text-lg font-semibold text-indigo-900">{formatUSD((summaryQuery.data.grandTotalUSD ?? 0) * 0.9)}</div>
            </div>
            <label className="text-[11px] text-indigo-700">
              Monto declarado USD
              <input value={declaredInvoiceUSD} onChange={e => setDeclaredInvoiceUSD(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-slate-900" />
            </label>
            <label className="text-[11px] text-indigo-700">
              TC bancario
              <input value={bankFx} onChange={e => setBankFx(e.target.value)} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-slate-900" />
            </label>
            <div>
              <div className="text-[11px] text-indigo-700">Sugerido equivalente ARS</div>
              <div className="mt-1 text-lg font-semibold text-indigo-900">
                {bankFx.trim() === "" ? "—" : formatARS(Number(bankFx) * Number((summaryQuery.data.grandTotalUSD ?? 0) * 0.9))}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-indigo-700">Diferencia USD</div>
              <div className="mt-1 text-lg font-semibold text-indigo-900">
                {declaredInvoiceUSD.trim() === "" ? "—" : formatUSD(Number(declaredInvoiceUSD) - Number((summaryQuery.data.grandTotalUSD ?? 0) * 0.9))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending || !existingForPeriod} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {reviewMutation.isPending ? "Enviando…" : "Enviar a aprobación de Operaciones"}
            </button>
            {existingForPeriod?.approvalStatus && <span className="text-xs text-indigo-700">Estado: {existingForPeriod.approvalStatus}</span>}
          </div>
        </div>
      )}

      {/* Historial */}
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Historial</h2>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Mes</th>
              <th className="px-4 py-2.5 text-right">Horas</th>
              <th className="px-4 py-2.5 text-right">ARS</th>
              <th className="px-4 py-2.5 text-right">USD</th>
              <th className="px-4 py-2.5">Archivo</th>
              <th className="px-4 py-2.5">Subida</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {invoicesQuery.isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">Cargando…</td></tr>
            )}
            {invoicesQuery.data && invoicesQuery.data.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">Todavía no subiste ninguna factura.</td></tr>
            )}
            {(invoicesQuery.data ?? []).map(row => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 capitalize">{formatPeriodLabel(row.period)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.hoursTotal?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatARS(row.computedTotalCostARS)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-blue-700">{formatUSD(row.computedTotalCostUSD)}</td>
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
