import { useMemo, useState } from "react";
import JSZip from "jszip";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authFetchJson } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type ImportTask = { title: string; assigneeName?: string; parent?: boolean; parentTitle?: string; description?: string };
type ImportSection = { name: string; tasks: ImportTask[] };
type Row = Record<string, string>;
type Field = "name" | "client" | "startDate" | "expectedEndDate" | "trackingFrequency" | "notes";
const FIELDS: Field[] = ["name", "client", "startDate", "expectedEndDate", "trackingFrequency", "notes"];
const LABELS: Record<Field, string> = { name: "Proyecto", client: "Cliente", startDate: "Inicio", expectedEndDate: "Fin estimado", trackingFrequency: "Frecuencia", notes: "Notas" };

function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((value) => value.trim()));
}

function columnNumber(reference: string) { return (reference.match(/[A-Z]+/)?.[0] || "A").split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1; }
async function readWorkbook(file: File): Promise<Array<{ name: string; rows: string[][] }>> {
  if (file.name.toLowerCase().endsWith(".csv")) return [{ name: "CSV", rows: parseDelimited(await file.text()) }];
  const zip = await JSZip.loadAsync(file);
  const workbookFile = zip.file("xl/workbook.xml");
  const relationshipsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!workbookFile || !relationshipsFile) throw new Error("No pude leer las hojas del Excel.");
  const workbookDoc = new DOMParser().parseFromString(await workbookFile.async("text"), "text/xml");
  const relationshipsDoc = new DOMParser().parseFromString(await relationshipsFile.async("text"), "text/xml");
  const targets = new Map(Array.from(relationshipsDoc.querySelectorAll("Relationship")).map((relationship) => [relationship.getAttribute("Id") || "", relationship.getAttribute("Target") || ""]));
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  const shared = sharedXml ? Array.from(new DOMParser().parseFromString(sharedXml, "text/xml").querySelectorAll("si")).map((si) => Array.from(si.querySelectorAll("t")).map((t) => t.textContent || "").join("")) : [];
  const sheets = await Promise.all(Array.from(workbookDoc.querySelectorAll("sheets sheet")).map(async (sheetNode) => {
    const name = sheetNode.getAttribute("name") || "Hoja";
    const relationshipId = sheetNode.getAttribute("r:id") || sheetNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || "";
    const target = targets.get(relationshipId);
    if (!target) return null;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const worksheet = zip.file(path);
    if (!worksheet) return null;
    const doc = new DOMParser().parseFromString(await worksheet.async("text"), "text/xml");
    const data: string[][] = [];
    for (const row of Array.from(doc.querySelectorAll("sheetData row"))) {
      const values: string[] = [];
      for (const cell of Array.from(row.querySelectorAll("c"))) {
        const idx = columnNumber(cell.getAttribute("r") || "A1");
        const value = cell.querySelector("v")?.textContent || "";
        values[idx] = cell.getAttribute("t") === "s" ? (shared[Number(value)] || "") : value;
      }
      data.push(values.map((value) => value || ""));
    }
    return { name, rows: data };
  }));
  return sheets.filter((sheet): sheet is { name: string; rows: string[][] } => Boolean(sheet));
}

function prepareSheet(sheetName: string, matrix: string[][]) {
  if (sheetName !== "Proyectos Asana a cargar") {
    const headers = (matrix[0] || []).map((value, index) => value.trim() || `Columna ${index + 1}`);
    return { headers, rows: matrix.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]))) as Row[] };
  }
  const headers = ["Cliente", "Nombre Proyecto Asana", "Inicio", "Fin estimado", "Frecuencia", "Notas"];
  const projects: Row[] = [];
  let currentProject: Row | null = null;
  let currentSectionName = "";
  let currentParent: ImportTask | null = null;
  for (const cells of matrix.slice(1)) {
    const clientName = (cells[0] || "").trim();
    const projectName = (cells[1] || "").trim();
    if (clientName && projectName) {
      const quote = (cells[2] || "").trim();
      const comment = (cells[3] || "").trim();
      const normalizedName = projectName.toLowerCase();
      const trackingFrequency = normalizedName.includes("monthly") || normalizedName.includes("mensual") || normalizedName.includes("operaciones") ? "monthly" : "weekly";
      const notes = [comment, quote && `Cotización referenciada en el Excel: ${quote}`].filter(Boolean).join("\n\n");
      const project: Row = { "Cliente": clientName, "Nombre Proyecto Asana": projectName, Inicio: "", "Fin estimado": "", Frecuencia: trackingFrequency, Notas: notes, __sections: "[]" };
      currentProject = project;
      projects.push(project);
      currentSectionName = "";
      currentParent = null;
    }
    if (!currentProject) continue;
    const sectionName = (cells[4] || "").trim();
    if (sectionName) {
      currentSectionName = sectionName;
      const projectSections = JSON.parse(currentProject.__sections || "[]") as ImportSection[];
      projectSections.push({ name: sectionName, tasks: [] });
      currentProject.__sections = JSON.stringify(projectSections);
      currentParent = null;
    }
    const title = (cells[5] || "").trim();
    if (!title) continue;
    if (!currentSectionName) {
      currentSectionName = "General";
      const projectSections = JSON.parse(currentProject.__sections || "[]") as ImportSection[];
      projectSections.push({ name: currentSectionName, tasks: [] });
      currentProject.__sections = JSON.stringify(projectSections);
    }
    const owner = (cells[6] || "").trim();
    const task: ImportTask = { title, assigneeName: owner && !/^nombre del asistente$/i.test(owner) ? owner : undefined, parent: /^si$/i.test((cells[7] || "").trim()), description: (cells[8] || "").trim() || undefined };
    if (!task.parent && currentParent) task.parentTitle = currentParent.title;
    const projectSections = JSON.parse(currentProject.__sections || "[]") as ImportSection[];
    const targetSection = projectSections.find((section) => section.name === currentSectionName);
    if (targetSection) targetSection.tasks.push(task);
    currentProject.__sections = JSON.stringify(projectSections);
    if (task.parent) currentParent = task;
  }
  return { headers, rows: projects };
}

function toDate(value: string) {
  const v = value.trim();
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d+(\.\d+)?$/.test(v) && Number(v) > 20000 && Number(v) < 100000) {
    const serial = Math.floor(Number(v));
    const date = new Date(Date.UTC(1899, 11, 30 + serial));
    return date.toISOString().slice(0, 10);
  }
  const dmy = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const date = new Date(v);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

export default function PortfolioImportPage() {
  const [workbookSheets, setWorkbookSheets] = useState<Array<{ name: string; rows: string[][] }>>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string>>({ name: "", client: "", startDate: "", expectedEndDate: "", trackingFrequency: "", notes: "" });
  const [replace, setReplace] = useState(false);
  const [fileName, setFileName] = useState("");
  const { toast } = useToast();
  const clientsQuery = useQuery<any[]>({ queryKey: ["/api/clients"], queryFn: () => authFetchJson("/api/clients") });
  const personnelQuery = useQuery<any[]>({ queryKey: ["/api/personnel"], queryFn: () => authFetchJson("/api/personnel") });
  const importMutation = useMutation({
    mutationFn: (projects: Array<Record<string, unknown>>) => authFetchJson("/api/active-projects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projects, replace }) }),
    onSuccess: (result: any) => toast({ title: "Cartera importada", description: `${result.created} proyectos agregados; ${result.archived} archivados de forma reversible.` }),
    onError: (error: Error) => toast({ title: "No se pudo importar", description: error.message, variant: "destructive" }),
  });
  const preview = useMemo(() => rows.slice(0, 8), [rows]);
  const payload = useMemo(() => rows.map((row) => ({
    name: mapping.name ? row[mapping.name]?.trim() : "",
    clientName: mapping.client ? row[mapping.client]?.trim() : "",
    startDate: mapping.startDate ? toDate(row[mapping.startDate] || "") : undefined,
    expectedEndDate: mapping.expectedEndDate ? toDate(row[mapping.expectedEndDate] || "") : undefined,
    trackingFrequency: mapping.trackingFrequency ? row[mapping.trackingFrequency]?.trim().toLowerCase() : "weekly",
    notes: mapping.notes ? row[mapping.notes]?.trim() : undefined,
    sections: JSON.parse(row.__sections || "[]") as ImportSection[],
  })), [rows, mapping]);
  const resolvedClientName = (clientName: string) => {
    const clients = clientsQuery.data || [];
    const normalized = clientName.trim().toLowerCase();
    const exact = clients.find((client) => client.name?.trim().toLowerCase() === normalized);
    if (exact) return exact.name;
    const prefixMatches = clients.filter((client) => client.name?.trim().toLowerCase().startsWith(`${normalized} `));
    return prefixMatches.length === 1 ? prefixMatches[0].name : clientName;
  };
  const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const personnelAliases: Record<string, string> = { "lola camara": "dolores camara", "lola camera": "dolores camara" };
  const resolvedPersonnel = (name: string) => (personnelQuery.data || []).some((person) => normalizeName(person.name || "") === (personnelAliases[normalizeName(name)] || normalizeName(name)));
  const validRows = payload.filter((row, index) => row.name && row.clientName && clientsQuery.data?.some((client) => client.name?.trim().toLowerCase() === resolvedClientName(row.clientName).toLowerCase())
    && row.sections.flatMap((section) => section.tasks).every((task) => !task.assigneeName || resolvedPersonnel(task.assigneeName))
    && (!mapping.startDate || !rows[index][mapping.startDate] || Boolean(row.startDate))
    && (!mapping.expectedEndDate || !rows[index][mapping.expectedEndDate] || Boolean(row.expectedEndDate))
    && (!row.startDate || !row.expectedEndDate || row.expectedEndDate >= row.startDate));

  const applySheet = (sheets: Array<{ name: string; rows: string[][] }>, sheetName: string) => {
    const source = sheets.find((sheet) => sheet.name === sheetName);
    if (!source) return;
    const prepared = prepareSheet(source.name, source.rows);
    const columns = prepared.headers;
    setSelectedSheet(source.name);
    setHeaders(columns);
    setRows(prepared.rows);
    const guess = (parts: string[]) => columns.find((column) => parts.some((part) => column.toLowerCase().includes(part))) || "";
    setMapping({ name: guess(["proyecto", "project", "nombre"]), client: guess(["cliente", "client", "cuenta"]), startDate: guess(["inicio", "start"]), expectedEndDate: guess(["fin", "end", "vencimiento"]), trackingFrequency: guess(["frecuencia", "frequency"]), notes: guess(["nota", "descrip", "observ"]) });
  };
  const openFile = async (file?: File) => {
    if (!file) return;
    try {
      const sheets = await readWorkbook(file);
      if (!sheets.length) throw new Error("El archivo no contiene hojas de datos.");
      const target = sheets.find((sheet) => sheet.name === "Proyectos Asana a cargar") || sheets[0];
      const prepared = prepareSheet(target.name, target.rows);
      if (prepared.rows.length === 0) throw new Error("La hoja debe incluir encabezados y al menos una fila de proyecto.");
      setWorkbookSheets(sheets);
      applySheet(sheets, target.name);
      setFileName(file.name);
    } catch (error) { toast({ title: "No pude abrir el archivo", description: (error as Error).message, variant: "destructive" }); }
  };
  const submit = () => {
    if (validRows.length !== rows.length) { toast({ title: "Hay filas para corregir", description: `${rows.length - validRows.length} filas no tienen proyecto o cliente válido.`, variant: "destructive" }); return; }
    if (replace && !window.confirm("Se marcarán como anulados los proyectos activos actuales. Sus datos permanecerán recuperables. ¿Continuar?")) return;
    importMutation.mutate(payload.map((row) => ({ ...row, clientName: resolvedClientName(row.clientName) })));
  };

  return <div className="mx-auto max-w-6xl space-y-5 py-4">
    <div><h1 className="text-2xl font-semibold">Importar cartera</h1><p className="text-sm text-muted-foreground">Subí un Excel o CSV, mapeá sus columnas y revisá la muestra antes de aplicar los cambios.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Archivo y mapeo</CardTitle></CardHeader><CardContent className="space-y-4">
      <input type="file" accept=".xlsx,.csv" onChange={(event) => openFile(event.target.files?.[0])} />{fileName && <Badge variant="outline">{fileName} · {rows.length} proyectos</Badge>}
      {workbookSheets.length > 1 && <div><Label>Hoja del Excel</Label><Select value={selectedSheet} onValueChange={(value) => applySheet(workbookSheets, value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workbookSheets.map((sheet) => <SelectItem key={sheet.name} value={sheet.name}>{sheet.name}</SelectItem>)}</SelectContent></Select></div>}
      {!!headers.length && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{FIELDS.map((field) => <div key={field}><Label>{LABELS[field]}{FIELDS.slice(0, 2).includes(field) ? " *" : ""}</Label><Select value={mapping[field] || "none"} onValueChange={(value) => setMapping({ ...mapping, [field]: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Seleccionar columna" /></SelectTrigger><SelectContent><SelectItem value="none">Sin mapear</SelectItem>{headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}</SelectContent></Select></div>)}</div>}
      {!!rows.length && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />Reemplazar la cartera activa. Se anularán de forma recuperable los proyectos actuales.</label>}
    </CardContent></Card>
    {!!preview.length && <Card><CardHeader><CardTitle className="text-base">Vista previa</CardTitle><p className="text-sm text-muted-foreground">{validRows.length} de {rows.length} proyectos válidos (se muestran hasta 8).</p></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr>{FIELDS.map((field) => <th key={field} className="p-2 text-left">{LABELS[field]}</th>)}<th className="p-2 text-left">Secciones y tareas</th><th className="p-2 text-left">Validación</th></tr></thead><tbody>{preview.map((_, index) => { const item = payload[index]; const valid = validRows.includes(item); const taskCount = item.sections.reduce((sum, section) => sum + section.tasks.length, 0); const missingOwners = [...new Set(item.sections.flatMap((section) => section.tasks.map((task) => task.assigneeName).filter((name): name is string => Boolean(name) && !resolvedPersonnel(name!))))]; return <tr key={index} className="border-t"><td className="p-2">{item.name || "—"}</td><td className="p-2">{item.clientName || "—"}</td><td className="p-2">{item.startDate || "—"}</td><td className="p-2">{item.expectedEndDate || "—"}</td><td className="p-2">{item.trackingFrequency || "weekly"}</td><td className="p-2">{item.notes || "—"}</td><td className="p-2">{item.sections.length} secciones · {taskCount} tareas</td><td className="p-2">{valid ? "Lista" : missingOwners.length ? `Responsables faltantes: ${missingOwners.join(", ")}` : "Revisar cliente o fechas"}</td></tr>; })}</tbody></table><Button className="mt-4" disabled={!rows.length || importMutation.isPending || validRows.length !== rows.length} onClick={submit}>{importMutation.isPending ? "Importando…" : "Importar cartera"}</Button></CardContent></Card>}
  </div>;
}
