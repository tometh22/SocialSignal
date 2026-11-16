import { QueryError } from "@/components/query-error";
import { useFinancePeriod } from "@/hooks/use-finance-period";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MetricCard, MetricGrid } from "@/components/ui/metric-card";
import { PageShell } from "@/components/ui/page-shell";
import { FinanceHeader, FinanceTableCard, StatusPill, formatUsd, periodLabel, usePeriodSource, PeriodSourceNotice } from "@/components/finance/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Scale, ShieldAlert, Undo2, UploadCloud } from "lucide-react";
import { Link } from "wouter";
import { Label } from "@/components/ui/label";
import { statusLabel } from "@/lib/status-labels";


export default function ProvisionsPage() {
  const { period } = useFinancePeriod();
  const [releaseRow, setReleaseRow] = useState<any | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const periodSource = usePeriodSource(period);


  const { data: provisionData, isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ["/api/provisions", period],
    queryFn: () => apiRequest(`/api/provisions?period=${period}`, "GET"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/provisions/${id}/approve`, "POST", {}),
    onSuccess: () => {
      toast({ title: "Provisión aprobada" });
      qc.invalidateQueries({ queryKey: ["/api/provisions"] });
    },
    onError: (error: Error) => toast({ title: "No se pudo aprobar", description: error.message, variant: "destructive" }),
  });
  const releaseMutation = useMutation({
    mutationFn: () => apiRequest(`/api/provisions/${releaseRow!.id}/release`, "POST", { amount: releaseAmount, periodKey: period, note: releaseNote }),
    onSuccess: () => {
      toast({ title: "Liberación registrada" });
      qc.invalidateQueries({ queryKey: ["/api/provisions"] });
      setReleaseRow(null); setReleaseAmount(""); setReleaseNote("");
    },
    onError: (error: Error) => toast({ title: "No se pudo liberar", description: error.message, variant: "destructive" }),
  });

  const rows = provisionData ?? [];
  const totalActivo = rows.filter(r => r.tipo === "NUEVA_PROVISION" && ["APPROVED", "ACTIVE", "MASTER"].includes(r.status)).reduce((s, r) => s + parseFloat(r.remainingAmount ?? r.montoProvision ?? "0"), 0);
  const totalRecupero = rows.filter(r => r.tipo === "RECUPERO" && ["APPROVED", "ACTIVE", "MASTER"].includes(r.status)).reduce((s, r) => s + parseFloat(r.montoProvision ?? "0"), 0);

  const net = provisionData ? totalActivo - totalRecupero : null;

  return (
    <PageShell width="wide" spacing="compact">
      <FinanceHeader
        title="Provisiones"
        description={`Facturación adelantada y contingencias vigentes en ${periodLabel(period)}.`}
        actions={<Button asChild variant="outline"><Link href={`/finance/cargar?period=${period}`}><UploadCloud className="mr-2 h-4 w-4" />Cargar provisión</Link></Button>}
      />
      <PeriodSourceNotice source={periodSource.data} otherRecords={periodSource.data?.otherSourceRecords.provisions} noun="las provisiones" />

      {isError && <QueryError message="No se pudieron cargar las provisiones del período." retry={refetch} />}
      <MetricGrid>
        <MetricCard label="Provisiones activas" value={formatUsd(provisionData ? totalActivo : null)} icon={<ShieldAlert />} tone="warning" detail="Saldo aprobado sin liberar" />
        <MetricCard label="Recuperos" value={formatUsd(provisionData ? totalRecupero : null)} icon={<Undo2 />} tone="success" />
        <MetricCard label="Neto provisionado" value={formatUsd(net)} icon={<Scale />} tone="neutral" detail="Activas menos recuperos" />
      </MetricGrid>

      <FinanceTableCard
        title="Provisiones del período"
        description={periodSource.data?.source === "master" ? "Saldo de cada provisión al cierre del mes según la solapa Provisión pasivo del Máster." : "Las propuestas requieren aprobación antes de afectar el resultado."}
        loading={isLoading} error={isError} onRetry={refetch} empty={rows.length === 0}
        emptyMessage={`No hay provisiones para ${periodLabel(period)}.`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Mes de aplicación</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Criterio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-px text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row: any) => {
              const status = row.status || "PROPOSED";
              return <TableRow key={row.id}>
                <TableCell><span className="font-medium">{row.clienteNombre || "—"}</span><span className="block text-xs text-muted-foreground">{row.importBatch ? "Máster" : "Registrado en Mind"}</span></TableCell>
                <TableCell>{row.tipo === "RECUPERO" ? <StatusPill tone="success">Recupero</StatusPill> : <StatusPill tone="info">Nueva provisión</StatusPill>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{row.mesAplicacion || row.periodKey}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{formatUsd(parseFloat(row.montoProvision ?? "0"))}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatUsd(parseFloat(row.remainingAmount ?? row.montoProvision ?? "0"))}</TableCell>
                <TableCell className="max-w-[220px]"><span className="block truncate text-sm text-muted-foreground" title={row.criterio || undefined}>{row.criterio || "—"}</span></TableCell>
                <TableCell><StatusPill tone={status === "PROPOSED" ? "warning" : ["APPROVED", "ACTIVE"].includes(status) ? "success" : status === "MASTER" ? "info" : "neutral"}>{statusLabel(row.status, "Propuesta")}</StatusPill></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {status === "PROPOSED" && <Button size="sm" variant="outline" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(row.id)}>Aprobar</Button>}
                    {["APPROVED", "ACTIVE"].includes(row.status) && Number(row.remainingAmount ?? row.montoProvision ?? 0) > 0 && <Button size="sm" variant="outline" onClick={() => { setReleaseRow(row); setReleaseAmount(String(row.remainingAmount ?? row.montoProvision ?? "")); }}>Liberar</Button>}
                  </div>
                </TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </FinanceTableCard>
      <Dialog open={Boolean(releaseRow)} onOpenChange={(open) => { if (!open) setReleaseRow(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Liberar provisión</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Monto ({releaseRow?.currency || "USD"})</Label><Input type="number" min="0.01" step="0.01" value={releaseAmount} onChange={(event) => setReleaseAmount(event.target.value)} /></div>
            <div><Label>Motivo</Label><Input value={releaseNote} onChange={(event) => setReleaseNote(event.target.value)} placeholder="Explicá por qué se libera" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReleaseRow(null)}>Cancelar</Button><Button disabled={releaseMutation.isPending || Number(releaseAmount) <= 0 || releaseNote.trim().length < 5} onClick={() => releaseMutation.mutate()}>Confirmar liberación</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
