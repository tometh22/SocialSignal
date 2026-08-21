import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Edit, Loader2, Trash2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PERSONNEL_AREAS,
  PERSONNEL_ROLE_LEVELS,
  allowedSublevelsForRole,
  normalizePersonnelRole,
} from "@shared/utils/personnel-classification";

interface PersonnelRow {
  [key: string]: unknown;
  id: number;
  name: string;
  email?: string | null;
  roleId: number;
  roleName: string;
  currentRole?: string | null;
  sublevel?: string | null;
  legacyRole?: string | null;
  area?: string | null;
  contractType?: string;
  monthlyHours?: number;
  includeInRealCosts?: boolean;
  billingCurrency?: string;
  usdBillingFraction?: number;
  activeUntil?: string | null;
  currentHourlyRateARS?: number | null;
  currentHourlyRateUSD?: number | null;
  currentMonthlySalaryARS?: number | null;
  currentMonthlySalaryUSD?: number | null;
  currentCostId?: number | null;
  ratePeriod?: string | null;
}

interface InlineEditPersonnelProps {
  person: PersonnelRow;
  roles: Array<{ id: number; name: string }>;
}

const contractLabel: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  freelance: "Freelance",
};

export default function InlineEditPersonnel({ person, roles }: InlineEditPersonnelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: person.name,
    email: person.email ?? "",
    roleId: String(person.roleId),
    currentRole: person.currentRole ?? "",
    legacyRole: person.legacyRole ?? "",
    area: person.area ?? "",
    sublevel: person.sublevel ?? "",
    contractType: person.contractType ?? "full-time",
    hourlyRateARS: person.currentHourlyRateARS == null ? "" : String(person.currentHourlyRateARS),
    hourlyRateUSD: person.currentHourlyRateUSD == null ? "" : String(person.currentHourlyRateUSD),
    monthlyHours: String(person.monthlyHours ?? 160),
    includeInRealCosts: person.includeInRealCosts ?? true,
    billingCurrency: person.billingCurrency ?? "ARS",
    usdBillingFraction: String(person.usdBillingFraction ?? 0),
    activeUntil: person.activeUntil ?? "",
  });

  useEffect(() => {
    setForm({
      name: person.name,
      email: person.email ?? "",
      roleId: String(person.roleId),
      currentRole: person.currentRole ?? "",
      legacyRole: person.legacyRole ?? "",
      area: person.area ?? "",
      sublevel: person.sublevel ?? "",
      contractType: person.contractType ?? "full-time",
      hourlyRateARS: person.currentHourlyRateARS == null ? "" : String(person.currentHourlyRateARS),
      hourlyRateUSD: person.currentHourlyRateUSD == null ? "" : String(person.currentHourlyRateUSD),
      monthlyHours: String(person.monthlyHours ?? 160),
      includeInRealCosts: person.includeInRealCosts ?? true,
      billingCurrency: person.billingCurrency ?? "ARS",
      usdBillingFraction: String(person.usdBillingFraction ?? 0),
      activeUntil: person.activeUntil ?? "",
    });
  }, [person]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const monthlyHours = Number(form.monthlyHours);
      const hourlyRateARS = form.hourlyRateARS === "" ? null : Number(form.hourlyRateARS);
      const hourlyRateUSD = form.hourlyRateUSD === "" ? null : Number(form.hourlyRateUSD);
      if (form.contractType !== "freelance" && (!Number.isFinite(monthlyHours) || monthlyHours < 40 || monthlyHours > 300)) {
        throw new Error("Las horas mensuales deben estar entre 40 y 300");
      }
      if ((hourlyRateARS != null && (!Number.isFinite(hourlyRateARS) || hourlyRateARS < 0)) || (hourlyRateUSD != null && (!Number.isFinite(hourlyRateUSD) || hourlyRateUSD < 0))) {
        throw new Error("El valor hora debe ser mayor o igual a cero");
      }
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        roleId: Number(form.roleId),
        currentRole: form.currentRole.trim() || null,
        legacyRole: form.legacyRole.trim() || person.legacyRole || null,
        sublevel: form.sublevel.trim() || null,
        area: form.area || null,
        contractType: form.contractType,
        monthlyHours: form.contractType === "freelance" ? undefined : monthlyHours,
        includeInRealCosts: form.includeInRealCosts,
        billingCurrency: form.billingCurrency,
        usdBillingFraction: Number(form.usdBillingFraction) || 0,
        activeUntil: form.activeUntil || null,
      };
      if (form.billingCurrency !== "USD") payload.hourlyRateARS = hourlyRateARS;
      if (form.billingCurrency !== "ARS") payload.hourlyRateUSD = hourlyRateUSD;
      await apiRequest(`/api/personnel/${person.id}`, "PATCH", payload);

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      setIsEditing(false);
      toast({ title: "Personal actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const dependencies = await apiRequest(`/api/personnel/${person.id}/dependencies`, "GET");
      if (dependencies.timeEntries > 0 || dependencies.quotations.length > 0 || dependencies.projects.length > 0) {
        throw new Error("La persona tiene horas, cotizaciones o proyectos asociados.");
      }
      if (!window.confirm(`¿Eliminar a "${person.name}"?`)) return false;
      await apiRequest(`/api/personnel/${person.id}`, "DELETE");
      return true;
    },
    onSuccess: (deleted) => {
      if (!deleted) return;
      queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
      toast({ title: "Personal eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "No se puede eliminar", description: error.message, variant: "destructive" });
    },
  });

  const money = (value: number | null | undefined, locale = "es-AR") =>
    value == null ? "—" : Number(value).toLocaleString(locale, { maximumFractionDigits: 2 });

  if (isEditing) {
    return (
      <tr className="border-b bg-blue-50/30">
        <td className="px-6 py-4"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></td>
        <td className="px-6 py-4"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></td>
        <td className="px-6 py-4">
          <div className="min-w-44 space-y-1">
            <Select value={form.roleId} onValueChange={(roleId) => setForm({ ...form, roleId })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={normalizePersonnelRole(form.currentRole) ?? undefined} onValueChange={(currentRole) => {
              const permitted = allowedSublevelsForRole(currentRole);
              setForm({ ...form, currentRole, sublevel: permitted.includes(form.sublevel) ? form.sublevel : "A" });
            }}>
              <SelectTrigger aria-label="Rol actual"><SelectValue placeholder="Seleccionar nivel" /></SelectTrigger>
              <SelectContent>{PERSONNEL_ROLE_LEVELS.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
            </Select>
            {form.contractType === "freelance" && <Input aria-label="Rol histórico" placeholder="Rol histórico del Máster" value={form.legacyRole} onChange={(event) => setForm({ ...form, legacyRole: event.target.value })} />}
          </div>
        </td>
        <td className="px-6 py-4">
          <Select value={form.sublevel || undefined} onValueChange={(sublevel) => setForm({ ...form, sublevel })}>
            <SelectTrigger aria-label="Subnivel"><SelectValue placeholder="Subnivel" /></SelectTrigger>
            <SelectContent>{allowedSublevelsForRole(form.currentRole).map((sublevel) => <SelectItem key={sublevel} value={sublevel}>{sublevel}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        <td className="px-6 py-4">
          <Select value={form.area || undefined} onValueChange={(area) => setForm({ ...form, area })}>
            <SelectTrigger aria-label="Área"><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>{PERSONNEL_AREAS.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        <td className="px-6 py-4">
          <Select value={form.contractType} onValueChange={(contractType) => setForm({ ...form, contractType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="part-time">Part-time</SelectItem>
              <SelectItem value="freelance">Freelance</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-6 py-4">
          <div className="min-w-32 space-y-1">
            {form.billingCurrency !== "USD" && <Input aria-label="Valor hora ARS" type="number" min={0} step="0.01" value={form.hourlyRateARS} onChange={(event) => setForm({ ...form, hourlyRateARS: event.target.value })} placeholder="ARS/h" />}
            {form.billingCurrency !== "ARS" && <Input aria-label="Valor hora USD" type="number" min={0} step="0.01" value={form.hourlyRateUSD} onChange={(event) => setForm({ ...form, hourlyRateUSD: event.target.value })} placeholder="USD/h" />}
          </div>
        </td>
        <td className="px-6 py-4 text-xs text-muted-foreground">
          <div>ARS {money(form.hourlyRateARS === "" ? null : Number(form.hourlyRateARS) * (Number(form.monthlyHours) || 0))}</div>
          <div>USD {money(form.hourlyRateUSD === "" ? null : Number(form.hourlyRateUSD) * (Number(form.monthlyHours) || 0), "en-US")}</div>
          <span className="text-[10px]">Calculado automáticamente</span>
        </td>
        <td className="px-6 py-4">
          {form.contractType === "freelance" ? "—" : (
            <Input type="number" min={40} max={300} value={form.monthlyHours} onChange={(event) => setForm({ ...form, monthlyHours: event.target.value })} />
          )}
        </td>
        <td className="px-6 py-4 text-center">
          <input type="checkbox" checked={form.includeInRealCosts} onChange={(event) => setForm({ ...form, includeInRealCosts: event.target.checked })} />
        </td>
        <td className="px-6 py-4">
          <Select value={form.billingCurrency} onValueChange={(billingCurrency) => setForm({ ...form, billingCurrency })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="mixed">Mixto</SelectItem>
            </SelectContent>
          </Select>
          {form.billingCurrency === "mixed" && (
            <Input className="mt-1" type="number" min={0} max={1} step={0.01} value={form.usdBillingFraction} onChange={(event) => setForm({ ...form, usdBillingFraction: event.target.value })} />
          )}
        </td>
        <td className="px-6 py-4"><Input type="date" value={form.activeUntil} onChange={(event) => setForm({ ...form, activeUntil: event.target.value })} /></td>
        <td className="px-6 py-4">
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}><X className="h-4 w-4 text-red-600" /></Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="px-6 py-4 font-medium">{person.name}</td>
      <td className="px-6 py-4 text-sm text-muted-foreground">{person.email || "—"}</td>
      <td className="px-6 py-4 text-sm">
        {person.currentRole || person.legacyRole || "Pendiente de asignar"}
      </td>
      <td className="px-6 py-4 text-sm">{person.sublevel || "—"}</td>
      <td className="px-6 py-4 text-sm">{person.area || "—"}</td>
      <td className="px-6 py-4 text-sm">{contractLabel[person.contractType ?? "full-time"]}</td>
      <td className="px-6 py-4 text-sm">
        <div>{money(person.currentHourlyRateARS)} ARS/h</div>
        <div className="text-xs text-muted-foreground">{money(person.currentHourlyRateUSD, "en-US")} USD/h · {person.ratePeriod ?? "sin período"}</div>
      </td>
      <td className="px-6 py-4 text-sm">
        <div>{money(person.currentMonthlySalaryARS)} ARS/mes</div>
        <div className="text-xs text-muted-foreground">{money(person.currentMonthlySalaryUSD, "en-US")} USD/mes</div>
      </td>
      <td className="px-6 py-4 text-sm">{person.contractType === "freelance" ? "—" : `${person.monthlyHours ?? 0}h/mes`}</td>
      <td className="px-6 py-4 text-center">{person.includeInRealCosts === false ? <X className="mx-auto h-4 w-4 text-red-600" /> : <Check className="mx-auto h-4 w-4 text-green-600" />}</td>
      <td className="px-6 py-4 text-sm">{person.billingCurrency ?? "ARS"}</td>
      <td className="px-6 py-4 text-sm">{person.activeUntil ?? "—"}</td>
      <td className="px-6 py-4">
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}><Edit className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
          </Button>
        </div>
      </td>
    </tr>
  );
}
