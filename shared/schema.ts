import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json, numeric, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ==================== USUARIOS ====================
// Tabla de usuarios
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  avatar: varchar("avatar", { length: 255 }),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Esquema para crear usuarios
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Esquema para iniciar sesión
export const loginUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// ==================== CLIENTES ====================
// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  logoUrl: varchar("logo_url", { length: 255 }),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertClientSchema = createInsertSchema(clients).pick({
  name: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  logoUrl: true,
  createdBy: true,
});

// ==================== ROLES ====================
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

// ==================== PERSONAL ====================
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

// ==================== PLANTILLAS DE REPORTES ====================
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
  baseCost: doublePrecision("base_cost").default(0),
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).pick({
  name: true,
  description: true,
  complexity: true,
  pageRange: true,
  features: true,
  platformCost: true,
  deviationPercentage: true,
  baseCost: true,
});

// ==================== COTIZACIONES ====================
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
  platformCost: doublePrecision("platform_cost").default(0), // Costo de plataforma
  deviationPercentage: doublePrecision("deviation_percentage").default(0), // Porcentaje de desviación
  discountPercentage: doublePrecision("discount_percentage").default(0), // Porcentaje de descuento
  totalAmount: doublePrecision("total_amount").notNull(),
  adjustmentReason: text("adjustment_reason"),
  additionalNotes: text("additional_notes"),
  status: text("status").notNull().default("draft"), // 'draft', 'pending', 'approved', 'rejected', 'in-negotiation'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== ASIGNACIÓN DE MIEMBROS DE EQUIPO ====================
// Quotation team members junction table
export const quotationTeamMembers = pgTable("quotation_team_members", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  personnelId: integer("personnel_id").notNull(),
  roleId: integer("role_id"), // ID del rol (puede ser diferente del rol del personnel)
  hours: doublePrecision("hours").notNull(),
  rate: doublePrecision("rate").notNull(),
  cost: doublePrecision("cost").notNull(),
  fte: doublePrecision("fte"), // Porcentaje en decimales (ej: 0.5 = 50%)
  dedication: doublePrecision("dedication"), // Porcentaje en entero (ej: 50%)
});

export const insertQuotationTeamMemberSchema = createInsertSchema(quotationTeamMembers).omit({
  id: true,
});

// ==================== ASIGNACIÓN DE ROLES EN PLANTILLAS ====================
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

// ==================== PROYECTOS ACTIVOS ====================
// Proyectos Activos
export const activeProjects = pgTable("active_projects", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id),
  clientId: integer("client_id").notNull().references(() => clients.id),
  status: text("status").notNull().default("active"), // active, completed, cancelled, on-hold
  startDate: timestamp("start_date").notNull(),
  expectedEndDate: timestamp("expected_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  trackingFrequency: text("tracking_frequency").notNull().default("weekly"), // daily, weekly, biweekly, monthly
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  
  // Campos para proyectos macro y subproyectos
  parentProjectId: integer("parent_project_id"), // Referencia al proyecto padre (para subproyectos)
  isAlwaysOnMacro: boolean("is_always_on_macro").default(false), // Indica si es un proyecto macro "Always On"
  macroMonthlyBudget: doublePrecision("macro_monthly_budget"), // Presupuesto mensual consolidado para proyectos "Always On"
  
  // Nuevos campos para entregables y frecuencias
  deliverableFrequency: text("deliverable_frequency"), // quincenal, mensual, trimestral, etc.
  deliverableType: text("deliverable_type"), // tipo de entregable (informe, reporte, análisis, etc.)
  deliverableBudget: doublePrecision("deliverable_budget"), // presupuesto específico para este entregable
  additionalDeliverableCost: doublePrecision("additional_deliverable_cost"), // costo de entregables opcionales/adicionales
  deliverableDescription: text("deliverable_description"), // descripción detallada del entregable
});

// Esquema base generado por drizzle-zod
const baseInsertActiveProjectSchema = createInsertSchema(activeProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Esquema personalizado que permite tanto Date como string para las fechas
export const insertActiveProjectSchema = baseInsertActiveProjectSchema.extend({
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  expectedEndDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  actualEndDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  parentProjectId: z.number().optional(),
  isAlwaysOnMacro: z.boolean().optional(),
  macroMonthlyBudget: z.number().optional(),
  
  // Nuevos campos para entregables
  deliverableFrequency: z.string().optional(), // quincenal, mensual, trimestral, etc.
  deliverableType: z.string().optional(), // tipo de entregable
  deliverableBudget: z.number().optional(), // presupuesto específico para este entregable
  additionalDeliverableCost: z.number().optional(), // costo adicional para entregables fuera de lo planeado
  deliverableDescription: z.string().optional(), // descripción detallada del entregable
});

// ==================== COMPONENTES DE PROYECTO ====================
// Tabla para los componentes de un proyecto (por ej. informes semanales, mensuales, SOV, newsletter)
export const projectComponents = pgTable("project_components", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  name: text("name").notNull(), // Ej: "Informe Semanal", "Informe Mensual", "SOV", "Newsletter"
  description: text("description"),
  isDefault: boolean("is_default").default(false), // Para identificar un componente por defecto
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertProjectComponentSchema = createInsertSchema(projectComponents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== REGISTRO DE HORAS ====================
// Registro de horas
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  componentId: integer("component_id").references(() => projectComponents.id), // Referencia opcional al componente
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  date: timestamp("date").notNull(),
  hours: doublePrecision("hours").notNull(),
  description: text("description"),
  approved: boolean("approved").default(true),
  approvedBy: integer("approved_by").references(() => personnel.id),
  approvedDate: timestamp("approved_date"),
  billable: boolean("billable").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Esquema base generado por drizzle-zod
const baseInsertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

// Esquema personalizado que permite tanto Date como string para las fechas
export const insertTimeEntrySchema = baseInsertTimeEntrySchema.extend({
  date: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  approvedDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

// ==================== INFORMES DE PROGRESO ====================
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

// ==================== SISTEMA DE CHAT ====================
// Tabla de conversaciones
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }),
  isGroup: boolean("is_group").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  projectId: integer("project_id").references(() => activeProjects.id),
});

// Esquema para crear conversaciones
export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
});

// Tabla de mensajes de chat
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  imageUrl: varchar("image_url", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  seen: boolean("seen").default(false),
});

// Esquema para crear mensajes
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

// Tabla de participantes en conversaciones
export const chatConversationParticipants = pgTable("chat_conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Esquema para agregar participantes
export const insertChatParticipantSchema = createInsertSchema(chatConversationParticipants).omit({
  id: true,
  createdAt: true,
});

// ==================== RELACIONES ====================

// Relaciones de clientes
export const clientsRelations = relations(clients, ({ many, one }) => ({
  quotations: many(quotations),
  creator: one(users, { fields: [clients.createdBy], references: [users.id] }),
}));

// Relaciones de roles
export const rolesRelations = relations(roles, ({ many }) => ({
  personnel: many(personnel),
  templateAssignments: many(templateRoleAssignments),
}));

// Relaciones de personal
export const personnelRelations = relations(personnel, ({ one, many }) => ({
  role: one(roles, { fields: [personnel.roleId], references: [roles.id] }),
  quotationTeamMembers: many(quotationTeamMembers),
}));

// Relaciones de plantillas de reportes
export const reportTemplatesRelations = relations(reportTemplates, ({ many }) => ({
  quotations: many(quotations),
  roleAssignments: many(templateRoleAssignments),
}));

// Relaciones de cotizaciones
export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  client: one(clients, { fields: [quotations.clientId], references: [clients.id] }),
  template: one(reportTemplates, { fields: [quotations.templateId], references: [reportTemplates.id] }),
  teamMembers: many(quotationTeamMembers),
  activeProjects: many(activeProjects),
  creator: one(users, { fields: [quotations.createdBy], references: [users.id] }),
}));

// Relaciones de miembros de equipo en cotizaciones
export const quotationTeamMembersRelations = relations(quotationTeamMembers, ({ one }) => ({
  quotation: one(quotations, { fields: [quotationTeamMembers.quotationId], references: [quotations.id] }),
  personnel: one(personnel, { fields: [quotationTeamMembers.personnelId], references: [personnel.id] }),
  role: one(roles, { fields: [quotationTeamMembers.roleId], references: [roles.id] }),
}));

// Relaciones de asignaciones de roles en plantillas
export const templateRoleAssignmentsRelations = relations(templateRoleAssignments, ({ one }) => ({
  template: one(reportTemplates, { fields: [templateRoleAssignments.templateId], references: [reportTemplates.id] }),
  role: one(roles, { fields: [templateRoleAssignments.roleId], references: [roles.id] }),
}));

// Relaciones de componentes de proyecto
export const projectComponentsRelations = relations(projectComponents, ({ one, many }) => ({
  project: one(activeProjects, { fields: [projectComponents.projectId], references: [activeProjects.id] }),
  timeEntries: many(timeEntries),
  creator: one(users, { fields: [projectComponents.createdBy], references: [users.id] }),
}));

// Relaciones de proyectos activos
export const activeProjectsRelations = relations(activeProjects, ({ one, many }) => ({
  quotation: one(quotations, { fields: [activeProjects.quotationId], references: [quotations.id] }),
  components: many(projectComponents),
  timeEntries: many(timeEntries),
  progressReports: many(progressReports),
  creator: one(users, { fields: [activeProjects.createdBy], references: [users.id] }),
  chatConversations: many(chatConversations),
}));

// Relaciones de registros de horas
export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  project: one(activeProjects, { fields: [timeEntries.projectId], references: [activeProjects.id] }),
  component: one(projectComponents, { fields: [timeEntries.componentId], references: [projectComponents.id] }),
  personnel: one(personnel, { fields: [timeEntries.personnelId], references: [personnel.id] }),
  approver: one(personnel, { fields: [timeEntries.approvedBy], references: [personnel.id] }),
  creator: one(users, { fields: [timeEntries.createdBy], references: [users.id] }),
}));

// Relaciones de informes de progreso
export const progressReportsRelations = relations(progressReports, ({ one }) => ({
  project: one(activeProjects, { fields: [progressReports.projectId], references: [activeProjects.id] }),
  creator: one(personnel, { fields: [progressReports.createdBy], references: [personnel.id] }),
}));

// Relaciones de usuario
export const usersRelations = relations(users, ({ many }) => ({
  createdClients: many(clients, { relationName: 'creator' }),
  createdQuotations: many(quotations, { relationName: 'creator' }),
  createdProjects: many(activeProjects, { relationName: 'creator' }),
  createdTimeEntries: many(timeEntries, { relationName: 'creator' }),
  sentMessages: many(chatMessages, { relationName: 'sender' }),
  participatingConversations: many(chatConversationParticipants),
  createdConversations: many(chatConversations, { relationName: 'creator' }),
}));

// Relaciones para el sistema de chat
export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  participants: many(chatConversationParticipants),
  messages: many(chatMessages),
  creator: one(users, { fields: [chatConversations.createdBy], references: [users.id] }),
  project: one(activeProjects, { fields: [chatConversations.projectId], references: [activeProjects.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, { fields: [chatMessages.conversationId], references: [chatConversations.id] }),
  sender: one(users, { fields: [chatMessages.senderId], references: [users.id] }),
}));

export const chatParticipantsRelations = relations(chatConversationParticipants, ({ one }) => ({
  conversation: one(chatConversations, { fields: [chatConversationParticipants.conversationId], references: [chatConversations.id] }),
  user: one(users, { fields: [chatConversationParticipants.userId], references: [users.id] }),
}));

// ==================== CONSTANTES Y OPCIONES ====================

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

// ==================== TIPOS EXPORTADOS ====================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;

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

export type TemplateRoleAssignment = typeof templateRoleAssignments.$inferSelect;
export type InsertTemplateRoleAssignment = z.infer<typeof insertTemplateRoleAssignmentSchema>;

export type ActiveProject = typeof activeProjects.$inferSelect;
export type InsertActiveProject = z.infer<typeof insertActiveProjectSchema>;

export type ProjectComponent = typeof projectComponents.$inferSelect;
export type InsertProjectComponent = z.infer<typeof insertProjectComponentSchema>;

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

export type ProgressReport = typeof progressReports.$inferSelect;
export type InsertProgressReport = z.infer<typeof insertProgressReportSchema>;

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type ChatParticipant = typeof chatConversationParticipants.$inferSelect;
export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;

// ==================== SEGUIMIENTO OPERACIONES (MODO) ====================
// Tabla de entregables
export const deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  deliveryMonth: text("delivery_month").notNull(),
  mes_entrega: integer("mes_entrega"), // Nuevo: número de mes (1-12)
  analystId: integer("analyst_id").references(() => personnel.id),
  pmId: integer("pm_id").references(() => personnel.id),
  deliveryOnTime: boolean("delivery_on_time").default(false),
  delay: integer("delay"),
  retrabajo: boolean("retrabajo").default(false), // Nuevo: si requirió retrabajo
  narrativeQuality: numeric("narrative_quality", { precision: 3, scale: 2 }),
  graphicsEffectiveness: numeric("graphics_effectiveness", { precision: 3, scale: 2 }),
  formatDesign: numeric("format_design", { precision: 3, scale: 2 }),
  relevantInsights: numeric("relevant_insights", { precision: 3, scale: 2 }),
  operationsFeedback: numeric("operations_feedback", { precision: 3, scale: 2 }),
  hoursEstimated: numeric("hours_estimated", { precision: 5, scale: 2 }),
  hoursActual: numeric("hours_actual", { precision: 5, scale: 2 }),
  clientFeedback: numeric("client_feedback", { precision: 3, scale: 2 }),
  feedback_general_cliente: numeric("feedback_general_cliente", { precision: 3, scale: 2 }), // Nuevo: feedback general del cliente (escala 1-5)
  briefCompliance: numeric("brief_compliance", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  project_id: integer("project_id").references(() => activeProjects.id), // Vinculación con proyecto
  delivery_date: timestamp("delivery_date"), // Fecha real de entrega
  due_date: timestamp("due_date"), // Fecha límite de entrega
  frequency: text("frequency"), // Frecuencia de entrega: semanal, quincenal, mensual, trimestral
  deliverable_type: text("deliverable_type"), // Tipo de entregable: informe, análisis, monitoreo, dashboard
  specific_budget: numeric("specific_budget", { precision: 8, scale: 2 }), // Presupuesto específico para este entregable
  parent_project_id: integer("parent_project_id").references(() => activeProjects.id), // Para relacionar con proyectos macro
});

// Relaciones de entregables
export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  client: one(clients, { fields: [deliverables.clientId], references: [clients.id] }),
  analyst: one(personnel, { fields: [deliverables.analystId], references: [personnel.id] }),
  pm: one(personnel, { fields: [deliverables.pmId], references: [personnel.id] }),
  creator: one(users, { fields: [deliverables.createdBy], references: [users.id] }),
  project: one(activeProjects, { fields: [deliverables.project_id], references: [activeProjects.id] }),
  parentProject: one(activeProjects, { fields: [deliverables.parent_project_id], references: [activeProjects.id] }),
}));

// Esquema para agregar entregables
export const insertDeliverableSchema = createInsertSchema(deliverables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tabla de comentarios del cliente sobre MODO
export const clientModoComments = pgTable("client_modo_comments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  quarter: integer("quarter").notNull(),
  year: integer("year").notNull(),
  generalQuality: numeric("general_quality", { precision: 3, scale: 2 }),
  insightsClarity: numeric("insights_clarity", { precision: 3, scale: 2 }),
  presentation: numeric("presentation", { precision: 3, scale: 2 }),
  nps: numeric("nps", { precision: 3, scale: 2 }),
  clientSurvey: numeric("client_survey", { precision: 3, scale: 2 }),
  operationsFeedback: numeric("operations_feedback", { precision: 3, scale: 2 }),
  hoursCompliance: numeric("hours_compliance", { precision: 3, scale: 2 }),
  clientFeedback: numeric("client_feedback", { precision: 3, scale: 2 }),
  briefCompliance: numeric("brief_compliance", { precision: 3, scale: 2 }),
  totalScore: numeric("total_score", { precision: 4, scale: 2 }).notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Relaciones de comentarios MODO
export const clientModoCommentsRelations = relations(clientModoComments, ({ one }) => ({
  client: one(clients, { fields: [clientModoComments.clientId], references: [clients.id] }),
  creator: one(users, { fields: [clientModoComments.createdBy], references: [users.id] }),
}));

// Esquema para agregar comentarios MODO
export const insertClientModoCommentSchema = createInsertSchema(clientModoComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Deliverable = typeof deliverables.$inferSelect;
export type InsertDeliverable = z.infer<typeof insertDeliverableSchema>;

export type ClientModoComment = typeof clientModoComments.$inferSelect;
export type InsertClientModoComment = z.infer<typeof insertClientModoCommentSchema>;

// ==================== ENCUESTAS NPS TRIMESTRALES ====================
// Tabla de encuestas NPS trimestrales a clientes
export const quarterlyNpsSurveys = pgTable("quarterly_nps_surveys", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  quarter: integer("quarter").notNull(), // 1, 2, 3, 4
  year: integer("year").notNull(),
  // Pregunta 2: Calidad general de los informes (0-10)
  reportQuality: integer("report_quality"),
  // Pregunta 3: Claridad y relevancia de los insights (0-10)
  insightsClarity: integer("insights_clarity"),
  // Pregunta 4: Cumplimiento de objetivos del brief (0-10)
  briefObjectives: integer("brief_objectives"),
  // Pregunta 5: Presentación y formato del informe (0-10)
  reportPresentation: integer("report_presentation"),
  // Pregunta 6: Qué cambiarías o mejorarías (texto libre)
  improvementSuggestions: text("improvement_suggestions"),
  // Pregunta 7: Qué estamos haciendo bien (texto libre)
  strengthsFeedback: text("strengths_feedback"),
  // Pregunta 8: NPS - Probabilidad de recomendación (0-10)
  npsScore: integer("nps_score"),
  // Campo calculado para clasificación NPS
  npsCategory: text("nps_category"), // 'promoter', 'passive', 'detractor'
  // Metadatos
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Relaciones de encuestas NPS
export const quarterlyNpsSurveysRelations = relations(quarterlyNpsSurveys, ({ one }) => ({
  client: one(clients, { fields: [quarterlyNpsSurveys.clientId], references: [clients.id] }),
  creator: one(users, { fields: [quarterlyNpsSurveys.createdBy], references: [users.id] }),
}));

// Esquema para crear encuestas NPS
export const insertQuarterlyNpsSurveySchema = createInsertSchema(quarterlyNpsSurveys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  npsCategory: true, // Se calcula automáticamente
});

export type QuarterlyNpsSurvey = typeof quarterlyNpsSurveys.$inferSelect;
export type InsertQuarterlyNpsSurvey = z.infer<typeof insertQuarterlyNpsSurveySchema>;
