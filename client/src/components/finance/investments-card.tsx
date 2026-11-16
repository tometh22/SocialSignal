import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd, periodLabel } from "@/components/finance/ui";

type Investments = { period: string; source: "master" | "mind"; totalUsd: number; items: Array<{ id: number; period_key: string; concepto: string | null; amount_usd: number }> };

/** Crypto and other investments at the month end: the latest valuation of each one. */
export function InvestmentsCard({ period }: { period: string }) {
  const key = `/api/finance/investments?period=${period}`;
  const query = useQuery<Investments>({ queryKey: [key] });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const save = useMutation({
    mutationFn: () => apiRequest("/api/finance/investments", "POST", { periodKey: period, name, amountUsd: Number(amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); qc.invalidateQueries({ queryKey: ["/api/v2/executive/dashboard"] }); setOpen(false); setName(""); setAmount(""); toast({ title: "Valuación registrada" }); },
    onError: (error: Error) => toast({ title: "No se pudo registrar", description: error.message, variant: "destructive" }),
  });
  const data = query.data;
  if (!data || (!data.items.length && data.source === "master")) return null;
  const names = [...new Set(data.items.map(item => item.concepto ?? ""))].filter(Boolean);
  return <Card data-testid="investments" className="p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Coins className="h-4 w-4 text-muted-foreground" />Inversiones al cierre de {periodLabel(period)} · {formatUsd(data.totalUsd)}</h2>
      {data.source === "mind" && <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Registrar valuación</Button></DialogTrigger>
        <DialogContent className="sm:max-w-md"><form className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(); }}>
          <DialogHeader><DialogTitle>Valuación de {periodLabel(period)}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Indicá el valor en dólares al cierre del mes. Reemplaza la valuación anterior de esa inversión desde este mes.</p>
          <div className="space-y-1"><Label htmlFor="investment-name">Inversión</Label><Input id="investment-name" list="investment-names" value={name} onChange={event => setName(event.target.value)} required placeholder="Ej. Cripto" />
            <datalist id="investment-names">{names.map(item => <option key={item} value={item} />)}</datalist></div>
          <div className="space-y-1"><Label htmlFor="investment-amount">Valor en USD</Label><Input id="investment-amount" type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={save.isPending}>Guardar</Button></DialogFooter>
        </form></DialogContent>
      </Dialog>}
    </div>
    {data.items.length ? <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">{data.items.map(item => <div key={item.id} className="flex items-baseline justify-between gap-3 border-b border-dashed pb-2">
      <dt className="truncate text-sm text-muted-foreground">{item.concepto}{item.period_key !== period && <span className="text-xs"> · valuada en {periodLabel(item.period_key)}</span>}</dt><dd className="text-sm font-semibold tabular-nums">{formatUsd(item.amount_usd)}</dd>
    </div>)}</dl> : <p className="mt-2 text-sm text-muted-foreground">Sin inversiones registradas.</p>}
  </Card>;
}
