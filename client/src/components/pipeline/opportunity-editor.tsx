import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Link2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetchJson } from "@/lib/queryClient";
import { pendingText, stageColors } from "./ui";
import {
  ProbabilityEditor,
  draftScore,
  type Methodology,
} from "./probability-editor";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermissions } from "@/hooks/use-permissions";
import {
  opportunitySchema,
  validateOpportunity,
  metrics,
  scopes,
  stages,
  statuses,
  usableProbability,
  type Opportunity,
} from "@shared/pipeline";

export interface OpportunityEditorProps {
  opportunity: Opportunity | null;
  readOnly?: boolean;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (data: Opportunity, reason: string) => Promise<void>;
}
const sections = [
  { name: "Oportunidad", icon: Target },
  { name: "Valor y cierre", icon: CalendarDays },
  { name: "Evidencia", icon: FileText },
  { name: "Vínculos", icon: Link2 },
] as const;
function Field({
  title,
  hint,
  children,
  wide = false,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
      </span>
      {children}
      {hint && (
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}
function SectionIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
function Choice({
  value,
  onChange,
  options,
  placeholder = "Pendiente",
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value || "__pending"}
      onValueChange={(v) => onChange(v === "__pending" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__pending">{placeholder}</SelectItem>
        {value && !options.some((o) => o.value === value) && (
          <SelectItem value={value}>{placeholder}</SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
const cash = (v: string | null | undefined) =>
  v == null || !Number.isFinite(Number(v))
    ? "Pendiente"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(v));
const array = (response: any): any[] =>
  Array.isArray(response)
    ? response
    : (response?.items ?? response?.data ?? []);

export function OpportunityEditor({
  opportunity,
  readOnly = false,
  busy = false,
  error = "",
  onClose,
  onSave,
}: OpportunityEditorProps) {
  const [draft, setDraft] = useState<Opportunity | null>(opportunity);
  const [section, setSection] = useState<string>("Oportunidad");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const search = useDebouncedValue(leadSearch, 250);
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const userName = [(user as any)?.firstName, (user as any)?.lastName]
    .filter(Boolean)
    .join(" ");
  const methodology = useQuery<Methodology | null>({
    queryKey: ["/api/crm/pipeline", "/methodology"],
    queryFn: () => authFetchJson("/api/crm/pipeline/methodology"),
    enabled: !!opportunity,
    staleTime: 60000,
  });
  const existingClient = !!(opportunity as any)?.model?.existingClient;
  useEffect(() => {
    setDraft(opportunity ? structuredClone(opportunity) : null);
    setSection("Oportunidad");
    setReason("");
    setLocalError("");
    setLeadSearch("");
  }, [opportunity]);
  const editable = !!opportunity && !readOnly;
  const assignees = useQuery<any[]>({
    queryKey: ["/api/crm/assignees"],
    queryFn: () => authFetchJson("/api/crm/assignees"),
    enabled: editable,
    staleTime: 60000,
  });
  const clients = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: () => authFetchJson("/api/clients"),
    enabled: editable && section === "Vínculos",
    staleTime: 60000,
  });
  const leads = useQuery<any>({
    queryKey: ["/api/crm/leads", "pipeline-lookup", search],
    queryFn: () =>
      authFetchJson(
        `/api/crm/leads?search=${encodeURIComponent(search)}&limit=12`,
      ),
    enabled: editable && section === "Vínculos" && search.trim().length >= 2,
  });
  const contacts = useQuery<any[]>({
    queryKey: ["/api/crm/leads", draft?.leadId, "contacts"],
    queryFn: () => authFetchJson(`/api/crm/leads/${draft?.leadId}/contacts`),
    enabled: editable && !!draft?.leadId,
    staleTime: 30000,
  });
  const quotations = useQuery<any[]>({
    queryKey: ["/api/quotations/client", draft?.clientId],
    queryFn: () => authFetchJson(`/api/quotations/client/${draft?.clientId}`),
    enabled:
      editable &&
      section === "Vínculos" &&
      !!draft?.clientId &&
      hasPermission("quotations"),
    staleTime: 30000,
  });
  if (!draft) return null;
  const change = <K extends keyof Opportunity>(key: K, value: Opportunity[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const textField = (
    key: keyof Opportunity,
    title: string,
    options: {
      hint?: string;
      multiline?: boolean;
      type?: string;
      wide?: boolean;
      placeholder?: string;
    } = {},
  ) => (
    <Field title={title} hint={options.hint} wide={options.wide}>
      {options.multiline ? (
        <Textarea
          aria-label={title}
          value={String(draft[key] ?? "")}
          onChange={(e) => change(key, e.target.value || null)}
          rows={3}
          className="resize-y"
          placeholder={options.placeholder ?? "Pendiente"}
          readOnly={readOnly}
        />
      ) : (
        <Input
          aria-label={title}
          value={String(draft[key] ?? "")}
          onChange={(e) =>
            change(key, e.target.value || (key === "account" ? "" : null))
          }
          type={options.type ?? "text"}
          placeholder={options.placeholder ?? "Pendiente"}
          readOnly={readOnly}
        />
      )}
    </Field>
  );
  const enumField = (
    key: "stage" | "status" | "scope" | "confidence",
    title: string,
    options: readonly string[],
  ) => (
    <Field title={title}>
      <Choice
        value={draft[key]}
        options={options.map((v) => ({ value: v, label: v }))}
        onChange={(v) => v && change(key, v as any)}
        disabled={readOnly}
      />
    </Field>
  );
  let result: { weighted: string | null } = { weighted: null };
  try {
    const calculationData = opportunitySchema.safeParse(
      Object.fromEntries(
        Object.keys(opportunitySchema.shape).map((key) => [
          key,
          draft[key as keyof Opportunity],
        ]),
      ),
    );
    if (calculationData.success)
      result = metrics([
        {
          ...calculationData.data,
          modelProbability:
            draftScore(calculationData.data, methodology.data, existingClient)
              ?.probability ?? null,
        },
      ]);
  } catch {
    /* An incomplete numeric input remains pending until it is valid. */
  }
  const save = async () => {
    setLocalError("");
    try {
      if (!reason.trim())
        throw new Error(
          "Agregá un motivo breve para registrar esta actualización.",
        );
      const clean = Object.fromEntries(
        Object.keys(opportunitySchema.shape).map((key) => [
          key,
          draft[key as keyof Opportunity],
        ]),
      );
      const data = validateOpportunity(clean);
      await onSave(data, reason.trim());
    } catch (e) {
      setLocalError((e as Error).message);
    }
  };
  const updateSource = (
    index: number,
    patch: Partial<Opportunity["sources"][number]>,
  ) =>
    change(
      "sources",
      draft.sources.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  return (
    <Dialog
      open={!!opportunity}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <DialogContent className="flex max-w-[1000px] max-h-[92dvh] flex-col gap-0 overflow-hidden border-slate-200 p-0 sm:p-0">
        <DialogHeader className="border-b bg-slate-50/80 px-5 pb-5 pt-6 text-left sm:px-7 dark:bg-slate-900/40">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Cartera comercial{" "}
            <ChevronRight className="h-3 w-3" />
            {readOnly
              ? "Corte guardado"
              : draft.id
                ? "Oportunidad"
                : "Nueva oportunidad"}
          </div>
          <DialogTitle className="pr-8 text-2xl font-semibold tracking-tight">
            {draft.account || "Nueva oportunidad"}
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm">
            {draft.project ||
              "Definí el alcance comercial y registrá la evidencia que lo respalda."}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge
              variant="outline"
              className="gap-1.5 bg-white text-xs font-medium dark:bg-slate-900"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${stageColors[draft.stage] ?? "bg-slate-400"}`}
              />
              {draft.stage}
            </Badge>
            <Badge
              variant="outline"
              className="bg-white text-xs font-medium dark:bg-slate-900"
            >
              {draft.scope}
            </Badge>
            {readOnly && (
              <Badge
                variant="outline"
                className="gap-1 bg-white text-xs font-medium text-slate-500 dark:bg-slate-900"
              >
                <ShieldCheck className="h-3 w-3" />
                Solo lectura
              </Badge>
            )}
            {draft.leadId && (
              <a
                href={`/crm/${draft.leadId}`}
                className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Abrir en CRM
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </DialogHeader>
        <div className="grid grid-cols-3 border-b bg-background px-5 py-4 sm:px-7">
          {[
            { label: "Valor total USD", text: cash(draft.usd) },
            {
              label: "Probabilidad",
              text: (() => {
                if (usableProbability(draft))
                  return draft.probability + "% · propia";
                const p = draftScore(
                  draft,
                  methodology.data,
                  existingClient,
                )?.probability;
                return p == null ? "Pendiente" : `${p}% · modelo`;
              })(),
            },
            { label: "Valor ponderado", text: cash(result.weighted) },
          ].map(({ label, text }, i) => (
            <div
              key={label}
              className={
                i === 0
                  ? "border-r pr-3"
                  : i === 1
                    ? "border-r px-3 sm:px-5"
                    : "pl-3 sm:pl-5"
              }
            >
              <p className="text-sm font-medium text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-lg font-semibold leading-7 tabular-nums">
                {text === "Pendiente" ? (
                  <span className={`text-base font-medium ${pendingText}`}>
                    Pendiente
                  </span>
                ) : (
                  text
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            aria-label="Secciones de la oportunidad"
            className="flex shrink-0 gap-1 overflow-x-auto border-b bg-slate-50/50 p-2 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r sm:p-3 dark:bg-slate-900/20"
          >
            {sections.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setSection(name)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${section === name ? "bg-white text-primary shadow-sm ring-1 ring-slate-200 dark:bg-slate-900" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              >
                <Icon className="h-4 w-4" />
                {name}
                {name === "Evidencia" && (
                  <span className="ml-auto rounded-md bg-slate-100 px-1.5 text-xs leading-5 tabular-nums text-slate-500">
                    {draft.sources.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              {section === "Oportunidad" && (
                <>
                  <SectionIntro
                    title="El alcance de esta oportunidad"
                    description="Una ficha por servicio o propuesta independiente. Los datos pendientes pueden completarse más adelante."
                  />
                  <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    {textField("account", "Cuenta")}
                    {textField("project", "Servicio o proyecto")}
                    {enumField("stage", "Etapa ejecutiva", stages)}
                    {enumField("status", "Estado comercial", statuses)}
                    {enumField("scope", "Alcance de cálculo", scopes)}
                    {enumField("confidence", "Confianza en la información", [
                      "Alta",
                      "Media",
                      "Baja",
                    ])}
                    <Field title="Responsable">
                      <Choice
                        value={draft.ownerId ? String(draft.ownerId) : null}
                        disabled={readOnly}
                        placeholder={draft.owner ?? "Sin responsable"}
                        options={array(assignees.data).map((u) => ({
                          value: String(u.id),
                          label: `${u.firstName} ${u.lastName}`,
                        }))}
                        onChange={(v) => {
                          change("ownerId", v ? Number(v) : null);
                          const owner = array(assignees.data).find(
                            (u) => String(u.id) === v,
                          );
                          if (owner)
                            change(
                              "owner",
                              `${owner.firstName} ${owner.lastName}`,
                            );
                        }}
                      />
                    </Field>
                    {draft.leadId && array(contacts.data).length ? (
                      <Field title="Contacto vinculado">
                        <Choice
                          value={
                            draft.contactId ? String(draft.contactId) : null
                          }
                          disabled={readOnly}
                          placeholder={
                            draft.contact ?? "Contacto primario del CRM"
                          }
                          options={array(contacts.data).map((c) => ({
                            value: String(c.id),
                            label: c.name,
                          }))}
                          onChange={(v) => {
                            change("contactId", v ? Number(v) : null);
                            const contact = array(contacts.data).find(
                              (c) => String(c.id) === v,
                            );
                            if (contact) change("contact", contact.name);
                          }}
                        />
                      </Field>
                    ) : (
                      textField("contact", "Contacto comercial")
                    )}
                    {textField("stageReason", "Fundamento de la etapa", {
                      multiline: true,
                      wide: true,
                      hint: `Etapa nativa del CRM: ${draft.nativeStage ?? "Pendiente de vinculación"}. Se conserva en el CRM.`,
                    })}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:bg-slate-900/30">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        disabled={readOnly}
                        checked={draft.eligible}
                        onChange={(e) => change("eligible", e.target.checked)}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          Alcance vigente para el cálculo
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Excluí alternativas no elegidas, revisiones
                          reemplazadas y componentes ya incluidos en un paquete.
                        </span>
                      </span>
                    </label>
                    {!draft.eligible && (
                      <div className="mt-4">
                        {textField("exclusionReason", "Motivo de exclusión", {
                          multiline: true,
                        })}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border p-4">
                    <label className="flex items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        disabled={readOnly}
                        checked={draft.warner}
                        onChange={(e) => change("warner", e.target.checked)}
                      />
                      Esta oportunidad pertenece al grupo Warner
                    </label>
                    {draft.warner && (
                      <div className="mt-4">
                        {textField(
                          "warnerBasis",
                          "Fundamento del vínculo Warner",
                          {
                            hint: "Cuenta verificada o alias conciliado con una fuente identificable.",
                          },
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              {section === "Valor y cierre" && (
                <>
                  <SectionIntro
                    title="Valor, probabilidad y próximos pasos"
                    description="La cobertura del pipeline mejora con importes respaldados y decisiones comerciales verificables."
                  />
                  <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                    {textField("usd", "Valor total validado · USD", {
                      hint: "Total del alcance. No anualizar un fee sin duración documentada.",
                    })}
                    {textField("closeDate", "Fecha objetivo de cierre", {
                      type: "date",
                    })}
                    {textField("valueNote", "Cómo se calculó el importe", {
                      multiline: true,
                      wide: true,
                    })}
                    {textField("originalAmount", "Precio original")}
                    <Field title="Moneda original">
                      <Choice
                        value={draft.currency}
                        options={["USD", "ARS", "EUR"].map((v) => ({
                          value: v,
                          label: v,
                        }))}
                        disabled={readOnly}
                        onChange={(v) =>
                          change("currency", v as Opportunity["currency"])
                        }
                      />
                    </Field>
                    {textField("priceBasis", "Base del precio", {
                      placeholder: "Por proyecto, mensual, paquete…",
                    })}
                    <Field title="Duración documentada · meses">
                      <Input
                        type="number"
                        min={1}
                        value={draft.durationMonths ?? ""}
                        placeholder="Pendiente"
                        readOnly={readOnly}
                        onChange={(e) =>
                          change(
                            "durationMonths",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    </Field>
                  </div>
                  {draft.currency && draft.currency !== "USD" && (
                    <details
                      className="rounded-xl border p-4"
                      open={!!draft.conversion}
                    >
                      <summary className="cursor-pointer text-sm font-medium">
                        Equivalencia aprobada a USD
                      </summary>
                      <p className="mb-4 mt-2 text-sm text-muted-foreground">
                        Si todavía no hay equivalencia aprobada, mantené el
                        valor total USD pendiente.
                      </p>
                      {!draft.conversion ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={readOnly}
                          onClick={() =>
                            change("conversion", {
                              rate: "",
                              direction: "multiply",
                              date: "",
                              source: "",
                              criterion: "",
                            })
                          }
                        >
                          Registrar equivalencia
                        </Button>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {(
                            ["rate", "date", "source", "criterion"] as const
                          ).map((k, i) => (
                            <Field
                              key={k}
                              title={
                                [
                                  "Tasa aprobada",
                                  "Fecha de conversión",
                                  "Fuente de la tasa",
                                  "Criterio aplicado",
                                ][i]
                              }
                            >
                              <Input
                                type={k === "date" ? "date" : "text"}
                                value={draft.conversion![k]}
                                readOnly={readOnly}
                                onChange={(e) =>
                                  change("conversion", {
                                    ...draft.conversion!,
                                    [k]: e.target.value,
                                  })
                                }
                              />
                            </Field>
                          ))}
                          <Field title="Dirección de conversión">
                            <Choice
                              disabled={readOnly}
                              value={draft.conversion.direction}
                              options={[
                                {
                                  value: "multiply",
                                  label: "Importe original × tasa",
                                },
                                {
                                  value: "divide",
                                  label: "Importe original ÷ tasa",
                                },
                              ]}
                              onChange={(v) =>
                                v &&
                                change("conversion", {
                                  ...draft.conversion!,
                                  direction: v as "multiply" | "divide",
                                })
                              }
                            />
                          </Field>
                          <Button
                            variant="ghost"
                            type="button"
                            disabled={readOnly}
                            onClick={() => change("conversion", null)}
                          >
                            Quitar equivalencia
                          </Button>
                        </div>
                      )}
                    </details>
                  )}
                  <ProbabilityEditor
                    draft={draft}
                    change={change as any}
                    readOnly={readOnly}
                    methodology={methodology.data}
                    existingClient={existingClient}
                    userName={userName}
                    ownProbabilityFields={
                      <div className="grid gap-4 sm:grid-cols-2">
                        {textField(
                          "probability",
                          "Probabilidad de cierre · %",
                          {
                            hint: "Entre 0 y 100.",
                          },
                        )}
                        <Field title="Evidencia de la probabilidad">
                          <Choice
                            value={draft.probabilitySource}
                            disabled={readOnly}
                            options={draft.sources
                              .filter((s) => s.title)
                              .map((s) => ({ value: s.key, label: s.title }))}
                            onChange={(v) => change("probabilitySource", v)}
                            placeholder="Elegir una fuente"
                          />
                        </Field>
                        {textField(
                          "probabilityReason",
                          "Motivo de la probabilidad",
                          { multiline: true, wide: true },
                        )}
                      </div>
                    }
                  />
                  <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 dark:bg-slate-900">
                    <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                      <CalendarDays className="h-4 w-4 text-sky-600" />
                      Próxima acción comercial
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {textField("next", "Próximo paso", {
                        multiline: true,
                        wide: true,
                      })}
                      {textField("nextDate", "Fecha del próximo paso", {
                        type: "date",
                        hint: "Es distinta de la fecha objetivo de cierre.",
                      })}
                    </div>
                  </div>
                </>
              )}
              {section === "Evidencia" && (
                <>
                  <SectionIntro
                    title="Evidencia que respalda la ficha"
                    description="Conservá referencias breves y verificables. Las ediciones técnicas no renuevan la fecha de evidencia comercial."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {textField("evidenceDate", "Última evidencia comercial", {
                      type: "date",
                    })}
                    {enumField("confidence", "Confianza", [
                      "Alta",
                      "Media",
                      "Baja",
                    ])}
                    {textField("evidence", "Qué está documentado", {
                      multiline: true,
                      wide: true,
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t pt-5">
                    <h4 className="text-sm font-semibold">
                      Fuentes{" "}
                      <span className="ml-1 text-muted-foreground">
                        ({draft.sources.length})
                      </span>
                    </h4>
                    {!readOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() =>
                          change("sources", [
                            ...draft.sources,
                            {
                              key: crypto.randomUUID(),
                              title: "",
                              url: "",
                              date: null,
                              excerpt: null,
                              kind: "external",
                            },
                          ])
                        }
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Agregar fuente
                      </Button>
                    )}
                  </div>
                  {draft.sources.length === 0 && (
                    <div className="rounded-xl border border-dashed p-7 text-center">
                      <FileText className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                      <p className="text-sm font-medium">
                        Todavía no hay fuentes vinculadas
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Agregá una propuesta, ficha de Mind o intercambio
                        comercial.
                      </p>
                    </div>
                  )}
                  {draft.sources.map((source, index) => (
                    <article
                      key={source.key}
                      className="rounded-xl border bg-background p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        <h5 className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {source.title || "Nueva fuente"}
                        </h5>
                        {/^https?:\/\//.test(source.url) && (
                          <a
                            aria-label={`Abrir ${source.title || "fuente"}`}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1.5 text-primary hover:bg-primary/5"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                        )}
                        {!readOnly && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-destructive"
                            aria-label={`Quitar fuente ${index + 1}`}
                            onClick={() => {
                              change(
                                "sources",
                                draft.sources.filter((_, i) => i !== index),
                              );
                              if (draft.probabilitySource === source.key)
                                change("probabilitySource", null);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {readOnly ? (
                        <>
                          <p className="break-all text-sm text-muted-foreground">
                            {source.url}
                          </p>
                          <p className="mt-2 text-sm">
                            {source.excerpt || "Sin extracto registrado"}
                          </p>
                        </>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field title="Título">
                            <Input
                              value={source.title}
                              onChange={(e) =>
                                updateSource(index, { title: e.target.value })
                              }
                            />
                          </Field>
                          <Field title="Fecha de la fuente">
                            <Input
                              type="date"
                              value={source.date ?? ""}
                              onChange={(e) =>
                                updateSource(index, {
                                  date: e.target.value || null,
                                })
                              }
                            />
                          </Field>
                          <Field title="Enlace" wide>
                            <Input
                              type="url"
                              placeholder="https://…"
                              value={source.url}
                              onChange={(e) =>
                                updateSource(index, { url: e.target.value })
                              }
                            />
                          </Field>
                          <Field title="Tipo de fuente">
                            <Choice
                              value={source.kind}
                              options={[
                                {
                                  value: "external",
                                  label: "Correo, documento o enlace externo",
                                },
                                { value: "crm", label: "CRM de Mind" },
                                {
                                  value: "quotation",
                                  label: "Cotización de Mind",
                                },
                              ]}
                              onChange={(v) =>
                                v &&
                                updateSource(index, {
                                  kind: v as typeof source.kind,
                                })
                              }
                            />
                          </Field>
                          <Field title="Extracto relevante" wide>
                            <Textarea
                              rows={2}
                              value={source.excerpt ?? ""}
                              onChange={(e) =>
                                updateSource(index, {
                                  excerpt: e.target.value || null,
                                })
                              }
                            />
                          </Field>
                        </div>
                      )}
                    </article>
                  ))}
                  {textField("notes", "Notas de conciliación", {
                    multiline: true,
                  })}
                </>
              )}
              {section === "Vínculos" && (
                <>
                  <SectionIntro
                    title="Conectá esta ficha con Mind"
                    description="Elegí los registros existentes. El vínculo permite conservar la cuenta, el responsable y el contacto canónicos del CRM."
                  />
                  {draft.leadId && (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                          <Check className="h-4 w-4" />
                          Lead vinculado
                        </p>
                        <p className="mt-1 text-sm text-emerald-700">
                          {draft.account} · CRM #{draft.leadId}
                        </p>
                      </div>
                      <a
                        href={`/crm/${draft.leadId}`}
                        className="text-sm font-semibold text-emerald-700 underline"
                      >
                        Ver ficha
                      </a>
                    </div>
                  )}
                  {!readOnly && (
                    <>
                      <Field
                        title="Buscar oportunidad en CRM"
                        hint="Buscá por cuenta, proyecto o contacto. Elegí una coincidencia verificada."
                      >
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={leadSearch}
                            onChange={(e) => setLeadSearch(e.target.value)}
                            placeholder="Escribí al menos 2 caracteres…"
                          />
                        </div>
                      </Field>
                      {leads.isFetching && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Buscando en CRM…
                        </p>
                      )}
                      {search.length >= 2 && array(leads.data).length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-xl border divide-y">
                          {array(leads.data).map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                              onClick={() => {
                                setDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        leadId: lead.id,
                                        account: lead.companyName,
                                        clientId: lead.clientId ?? d.clientId,
                                        ownerId: lead.assignedTo ?? d.ownerId,
                                        quotationGroupId:
                                          lead.quotationGroupId ??
                                          d.quotationGroupId,
                                        contactId:
                                          lead.primaryContact?.id ?? null,
                                        contact:
                                          lead.primaryContact?.name ??
                                          d.contact,
                                        nativeStage: lead.stage,
                                      }
                                    : d,
                                );
                                setLeadSearch("");
                              }}
                            >
                              <span>
                                <span className="block text-sm font-medium">
                                  {lead.companyName}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {lead.opportunityName ||
                                    lead.primaryContact?.name ||
                                    "Sin alcance documentado"}
                                </span>
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      )}
                      {leads.isError && (
                        <p role="alert" className="text-sm text-destructive">
                          No se pudieron cargar los leads. Probá nuevamente.
                        </p>
                      )}
                    </>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field title="Cuenta registrada">
                      <Choice
                        disabled={readOnly}
                        value={draft.clientId ? String(draft.clientId) : null}
                        placeholder={
                          draft.clientId
                            ? `Cuenta vinculada #${draft.clientId}`
                            : "Pendiente de conciliar"
                        }
                        options={array(clients.data).map((c) => ({
                          value: String(c.id),
                          label: c.name ?? c.companyName ?? `Cuenta ${c.id}`,
                        }))}
                        onChange={(v) => {
                          change("clientId", v ? Number(v) : null);
                          change("quotationId", null);
                        }}
                      />
                    </Field>
                    <Field title="Cotización vinculada">
                      <Choice
                        disabled={
                          readOnly ||
                          !draft.clientId ||
                          !hasPermission("quotations")
                        }
                        value={
                          draft.quotationId ? String(draft.quotationId) : null
                        }
                        placeholder={
                          draft.quotationId
                            ? `Cotización #${draft.quotationId}`
                            : "Elegir cuenta primero"
                        }
                        options={array(quotations.data).map((q) => ({
                          value: String(q.id),
                          label: `${q.quotationNumber ?? `#${q.id}`} · ${q.projectName ?? "Propuesta"}`,
                        }))}
                        onChange={(v) =>
                          change("quotationId", v ? Number(v) : null)
                        }
                      />
                    </Field>
                  </div>
                  {draft.quotationId && (
                    <a
                      href={`/quotations/${draft.quotationId}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      Abrir cotización
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <details className="rounded-xl border p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                      Identificadores y vínculos pendientes de conciliación
                    </summary>
                    <p className="my-3 text-sm text-muted-foreground">
                      Usá identificadores verificados cuando el registro no
                      aparezca en la búsqueda.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          "leadId",
                          "clientId",
                          "ownerId",
                          "contactId",
                          "quotationId",
                          "quotationGroupId",
                        ] as const
                      ).map((key, i) => (
                        <Field
                          key={key}
                          title={
                            [
                              "Lead de CRM",
                              "Cuenta de Mind",
                              "Responsable",
                              "Contacto del lead",
                              "Cotización",
                              "Grupo de cotizaciones",
                            ][i]
                          }
                        >
                          <Input
                            type="number"
                            min={1}
                            readOnly={readOnly}
                            value={draft[key] ?? ""}
                            placeholder="Pendiente"
                            onChange={(e) =>
                              change(
                                key,
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </fieldset>
          </div>
        </div>
        <div className="border-t bg-slate-50/80 px-5 py-4 sm:px-7 dark:bg-slate-900/30">
          {(localError || error) && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {localError || error}
            </p>
          )}
          {readOnly ? (
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Este corte conserva los datos al momento de guardarlo.
              </p>
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1.5">
                <span className="text-sm font-semibold text-muted-foreground">
                  Motivo de la actualización
                </span>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="¿Qué cambió y en qué evidencia se basa?"
                  disabled={busy}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={busy}>
                  Cancelar
                </Button>
                <Button onClick={() => void save()} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
