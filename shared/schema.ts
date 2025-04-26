import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
});

export const insertClientSchema = createInsertSchema(clients).pick({
  name: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
});

export const clientsRelations = relations(clients, ({ many }) => ({
  quotations: many(quotations),
}));

// Team roles table
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  defaultRate: doublePrecision("default_rate").notNull(),
});

export const insertRoleSchema = createInsertSchema(roles).pick({
  name: true,
  description: true,
  defaultRate: true,
});

export const rolesRelations = relations(roles, ({ many }) => ({
  personnel: many(personnel),
}));

// Team personnel table
export const personnel = pgTable("personnel", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  roleId: integer("role_id").notNull(),
  hourlyRate: doublePrecision("hourly_rate").notNull(),
});

export const insertPersonnelSchema = createInsertSchema(personnel).pick({
  name: true,
  roleId: true,
  hourlyRate: true,
});

export const personnelRelations = relations(personnel, ({ one, many }) => ({
  role: one(roles, { fields: [personnel.roleId], references: [roles.id] }),
  quotationTeamMembers: many(quotationTeamMembers),
}));

// Report templates table
export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  complexity: text("complexity").notNull(), // 'low', 'medium', 'high'
  pageRange: text("page_range"),
  features: text("features"),
  platformCost: doublePrecision("platform_cost").default(0),
  deviationPercentage: doublePrecision("deviation_percentage").default(0),
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).pick({
  name: true,
  description: true,
  complexity: true,
  pageRange: true,
  features: true,
  platformCost: true,
  deviationPercentage: true,
});

export const reportTemplatesRelations = relations(reportTemplates, ({ many }) => ({
  quotations: many(quotations),
}));

// Quotations table
export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  projectName: text("project_name").notNull(),
  analysisType: text("analysis_type").notNull(), // 'basic', 'standard', 'deep'
  projectType: text("project_type").notNull(), // 'demo', 'executive', 'comprehensive', 'always-on', 'monitoring'
  mentionsVolume: text("mentions_volume").notNull(), // 'small', 'medium', 'large', 'xlarge'
  countriesCovered: text("countries_covered").notNull(), // '1', '2-5', '6-10', '10+'
  clientEngagement: text("client_engagement").notNull(), // 'low', 'medium', 'high'
  templateId: integer("template_id"),
  templateCustomization: text("template_customization"),
  baseCost: doublePrecision("base_cost").notNull(),
  complexityAdjustment: doublePrecision("complexity_adjustment").notNull(),
  markupAmount: doublePrecision("markup_amount").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  adjustmentReason: text("adjustment_reason"),
  additionalNotes: text("additional_notes"),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'in-negotiation'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  client: one(clients, { fields: [quotations.clientId], references: [clients.id] }),
  template: one(reportTemplates, { fields: [quotations.templateId], references: [reportTemplates.id] }),
  teamMembers: many(quotationTeamMembers),
}));

// Quotation team members junction table
export const quotationTeamMembers = pgTable("quotation_team_members", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  personnelId: integer("personnel_id").notNull(),
  hours: doublePrecision("hours").notNull(),
  rate: doublePrecision("rate").notNull(),
  cost: doublePrecision("cost").notNull(),
});

export const insertQuotationTeamMemberSchema = createInsertSchema(quotationTeamMembers).omit({
  id: true,
});

export const quotationTeamMembersRelations = relations(quotationTeamMembers, ({ one }) => ({
  quotation: one(quotations, { fields: [quotationTeamMembers.quotationId], references: [quotations.id] }),
  personnel: one(personnel, { fields: [quotationTeamMembers.personnelId], references: [personnel.id] }),
}));

// Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Personnel = typeof personnel.$inferSelect;
export type InsertPersonnel = z.infer<typeof insertPersonnelSchema>;

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;

export type QuotationTeamMember = typeof quotationTeamMembers.$inferSelect;
export type InsertQuotationTeamMember = z.infer<typeof insertQuotationTeamMemberSchema>;

// Opciones de metodología de análisis
export const analysisTypes = [
  { value: "basic", label: "Metodología Básica" },
  { value: "standard", label: "Metodología Estándar" },
  { value: "deep", label: "Metodología Avanzada" },
];

// Opciones de tipo de proyecto
export const projectTypes = [
  { value: "demo", label: "Informe Demo" },
  { value: "executive", label: "Informe Ejecutivo" },
  { value: "comprehensive", label: "Informe Exhaustivo" },
  { value: "always-on", label: "Always On" },
  { value: "monitoring", label: "Servicio de Monitoreo" },
];

// Opciones de volumen de menciones
export const mentionsVolumeOptions = [
  { value: "small", label: "1k - 10k menciones" },
  { value: "medium", label: "10k - 50k menciones" },
  { value: "large", label: "50k - 200k menciones" },
  { value: "xlarge", label: "200k+ menciones" },
];

// Opciones de países cubiertos
export const countriesCoveredOptions = [
  { value: "1", label: "Un solo país" },
  { value: "2-5", label: "2-5 países" },
  { value: "6-10", label: "6-10 países" },
  { value: "10+", label: "10+ países" },
];

// Opciones de nivel de participación del cliente
export const clientEngagementOptions = [
  { value: "low", label: "Bajo (Revisiones mínimas)" },
  { value: "medium", label: "Medio (2-3 ciclos de revisión)" },
  { value: "high", label: "Alto (Múltiples interacciones)" },
];

// Opciones de estado de cotización
export const quotationStatusOptions = [
  { value: "pending", label: "Pendiente" },
  { value: "approved", label: "Aprobado" },
  { value: "rejected", label: "Rechazado" },
  { value: "in-negotiation", label: "En Negociación" },
];

// Template Role Assignments table
export const templateRoleAssignments = pgTable("template_role_assignments", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => reportTemplates.id),
  roleId: integer("role_id").notNull().references(() => roles.id),
  hours: numeric("hours", { precision: 8, scale: 2 }).notNull().default("0"),
});

export const insertTemplateRoleAssignmentSchema = createInsertSchema(templateRoleAssignments).omit({
  id: true,
});

export const templateRoleAssignmentsRelations = relations(templateRoleAssignments, ({ one }) => ({
  template: one(reportTemplates, { fields: [templateRoleAssignments.templateId], references: [reportTemplates.id] }),
  role: one(roles, { fields: [templateRoleAssignments.roleId], references: [roles.id] }),
}));

// Update existing relations
export const rolesRelationsWithTemplates = relations(roles, ({ many }) => ({
  personnel: many(personnel),
  templateAssignments: many(templateRoleAssignments),
}));

export const reportTemplatesRelationsWithRoles = relations(reportTemplates, ({ many }) => ({
  quotations: many(quotations),
  roleAssignments: many(templateRoleAssignments),
}));

export type TemplateRoleAssignment = typeof templateRoleAssignments.$inferSelect;
export type InsertTemplateRoleAssignment = z.infer<typeof insertTemplateRoleAssignmentSchema>;

// Proyectos Activos
export const activeProjects = pgTable("active_projects", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id),
  status: text("status").notNull().default("active"), // active, completed, cancelled, on-hold
  startDate: timestamp("start_date").notNull(),
  expectedEndDate: timestamp("expected_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  trackingFrequency: text("tracking_frequency").notNull().default("weekly"), // daily, weekly, biweekly, monthly
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertActiveProjectSchema = createInsertSchema(activeProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Nota: La relación con timeEntries se definirá después de declarar timeEntries
export const activeProjectsRelations = relations(activeProjects, ({ one }) => ({
  quotation: one(quotations, { fields: [activeProjects.quotationId], references: [quotations.id] }),
}));

// Registro de horas
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  date: timestamp("date").notNull(),
  hours: doublePrecision("hours").notNull(),
  description: text("description"),
  approved: boolean("approved").default(false),
  approvedBy: integer("approved_by").references(() => personnel.id),
  approvedDate: timestamp("approved_date"),
  billable: boolean("billable").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  project: one(activeProjects, { fields: [timeEntries.projectId], references: [activeProjects.id] }),
  personnel: one(personnel, { fields: [timeEntries.personnelId], references: [personnel.id] }),
  approver: one(personnel, { fields: [timeEntries.approvedBy], references: [personnel.id] }),
}));

// Informes de progreso
export const progressReports = pgTable("progress_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  reportDate: timestamp("report_date").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalHoursLogged: doublePrecision("total_hours_logged").notNull(),
  totalCostToDate: doublePrecision("total_cost_to_date").notNull(),
  budgetPercentUsed: doublePrecision("budget_percent_used").notNull(),
  statusSummary: text("status_summary").notNull(),
  challenges: text("challenges"),
  nextSteps: text("next_steps"),
  createdBy: integer("created_by").notNull().references(() => personnel.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProgressReportSchema = createInsertSchema(progressReports).omit({
  id: true,
  createdAt: true,
});

export const progressReportsRelations = relations(progressReports, ({ one }) => ({
  project: one(activeProjects, { fields: [progressReports.projectId], references: [activeProjects.id] }),
  creator: one(personnel, { fields: [progressReports.createdBy], references: [personnel.id] }),
}));

// Opciones de estado de proyecto
export const projectStatusOptions = [
  { value: "active", label: "Activo" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "on-hold", label: "En Pausa" },
];

// Opciones de frecuencia de seguimiento
export const trackingFrequencyOptions = [
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
];

// Tipos exportados
export type ActiveProject = typeof activeProjects.$inferSelect;
export type InsertActiveProject = z.infer<typeof insertActiveProjectSchema>;

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

export type ProgressReport = typeof progressReports.$inferSelect;
export type InsertProgressReport = z.infer<typeof insertProgressReportSchema>;

// Completamos las relaciones circulares
export const activeProjectsRelationsComplete = relations(activeProjects, ({ one, many }) => ({
  quotation: one(quotations, { fields: [activeProjects.quotationId], references: [quotations.id] }),
  timeEntries: many(timeEntries),
  progressReports: many(progressReports),
}));

// Actualizar relaciones de quotations para incluir proyectos activos
export const quotationsRelationsWithProjects = relations(quotations, ({ one, many }) => ({
  client: one(clients, { fields: [quotations.clientId], references: [clients.id] }),
  template: one(reportTemplates, { fields: [quotations.templateId], references: [reportTemplates.id] }),
  teamMembers: many(quotationTeamMembers),
  activeProjects: many(activeProjects),
}));
