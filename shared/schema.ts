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

// ==================== TOKENS DE RECUPERACIÓN ====================
// Tabla para tokens de recuperación de contraseña
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Esquema para solicitar recuperación de contraseña
export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

// Esquema para resetear contraseña
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// ==================== COSTOS INDIRECTOS ====================
// Tabla de categorías de costos indirectos
export const indirectCostCategories = pgTable("indirect_cost_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // 'fixed', 'variable', 'executive', 'tax', 'subscription'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tabla de costos indirectos
export const indirectCosts = pgTable("indirect_costs", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => indirectCostCategories.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default('USD'),
  period: varchar("period", { length: 20 }).notNull(), // 'monthly', 'quarterly', 'annual', 'one-time'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tabla de horas no asignables (reuniones internas, presentaciones comerciales, etc)
export const nonBillableHours = pgTable("non_billable_hours", {
  id: serial("id").primaryKey(),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  categoryId: integer("category_id").notNull().references(() => indirectCostCategories.id),
  date: timestamp("date").notNull(),
  endDate: timestamp("end_date"), // Optional end date for date ranges
  hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Esquemas de inserción
export const insertIndirectCostCategorySchema = createInsertSchema(indirectCostCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIndirectCostSchema = createInsertSchema(indirectCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNonBillableHoursSchema = createInsertSchema(nonBillableHours).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tipos
export type IndirectCostCategory = typeof indirectCostCategories.$inferSelect;
export type InsertIndirectCostCategory = z.infer<typeof insertIndirectCostCategorySchema>;
export type IndirectCost = typeof indirectCosts.$inferSelect;
export type InsertIndirectCost = z.infer<typeof insertIndirectCostSchema>;
export type NonBillableHours = typeof nonBillableHours.$inferSelect;
export type InsertNonBillableHours = z.infer<typeof insertNonBillableHoursSchema>;

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
  email: text("email"), // Email opcional
  roleId: integer("role_id").notNull(),
  hourlyRate: doublePrecision("hourly_rate").notNull(), // USD per hour
  hourlyRateARS: doublePrecision("hourly_rate_ars"), // ARS per hour for local projects
  contractType: text("contract_type").notNull().default("full-time"), // 'full-time', 'part-time', 'freelance'
  monthlyFixedSalary: doublePrecision("monthly_fixed_salary"), // For full-time employees
  monthlyHours: doublePrecision("monthly_hours").default(160), // Standard monthly hours for full-time employees (160 = 8h/day * 20 working days)
  includeInRealCosts: boolean("include_in_real_costs").notNull().default(true), // Whether to include in real cost calculations
  
  // ==================== COSTOS HISTÓRICOS 2025 ====================
  // Enero 2025
  jan2025HourlyRateARS: doublePrecision("jan_2025_hourly_rate_ars"),
  jan2025MonthlySalaryARS: doublePrecision("jan_2025_monthly_salary_ars"),
  
  // Febrero 2025
  feb2025HourlyRateARS: doublePrecision("feb_2025_hourly_rate_ars"),
  feb2025MonthlySalaryARS: doublePrecision("feb_2025_monthly_salary_ars"),
  
  // Marzo 2025
  mar2025HourlyRateARS: doublePrecision("mar_2025_hourly_rate_ars"),
  mar2025MonthlySalaryARS: doublePrecision("mar_2025_monthly_salary_ars"),
  
  // Abril 2025
  apr2025HourlyRateARS: doublePrecision("apr_2025_hourly_rate_ars"),
  apr2025MonthlySalaryARS: doublePrecision("apr_2025_monthly_salary_ars"),
  
  // Mayo 2025
  may2025HourlyRateARS: doublePrecision("may_2025_hourly_rate_ars"),
  may2025MonthlySalaryARS: doublePrecision("may_2025_monthly_salary_ars"),
  
  // Junio 2025
  jun2025HourlyRateARS: doublePrecision("jun_2025_hourly_rate_ars"),
  jun2025MonthlySalaryARS: doublePrecision("jun_2025_monthly_salary_ars"),
  
  // Julio 2025
  jul2025HourlyRateARS: doublePrecision("jul_2025_hourly_rate_ars"),
  jul2025MonthlySalaryARS: doublePrecision("jul_2025_monthly_salary_ars"),
  
  // Agosto 2025
  aug2025HourlyRateARS: doublePrecision("aug_2025_hourly_rate_ars"),
  aug2025MonthlySalaryARS: doublePrecision("aug_2025_monthly_salary_ars"),
  
  // Septiembre 2025
  sep2025HourlyRateARS: doublePrecision("sep_2025_hourly_rate_ars"),
  sep2025MonthlySalaryARS: doublePrecision("sep_2025_monthly_salary_ars"),
  
  // Octubre 2025
  oct2025HourlyRateARS: doublePrecision("oct_2025_hourly_rate_ars"),
  oct2025MonthlySalaryARS: doublePrecision("oct_2025_monthly_salary_ars"),
  
  // Noviembre 2025
  nov2025HourlyRateARS: doublePrecision("nov_2025_hourly_rate_ars"),
  nov2025MonthlySalaryARS: doublePrecision("nov_2025_monthly_salary_ars"),
  
  // Diciembre 2025
  dec2025HourlyRateARS: doublePrecision("dec_2025_hourly_rate_ars"),
  dec2025MonthlySalaryARS: doublePrecision("dec_2025_monthly_salary_ars"),
});

export const insertPersonnelSchema = createInsertSchema(personnel).pick({
  name: true,
  email: true,
  roleId: true,
  hourlyRate: true,
  hourlyRateARS: true,
  contractType: true,
  monthlyFixedSalary: true,
  monthlyHours: true,
  includeInRealCosts: true,
  // Costos históricos 2025
  jan2025HourlyRateARS: true,
  jan2025MonthlySalaryARS: true,
  feb2025HourlyRateARS: true,
  feb2025MonthlySalaryARS: true,
  mar2025HourlyRateARS: true,
  mar2025MonthlySalaryARS: true,
  apr2025HourlyRateARS: true,
  apr2025MonthlySalaryARS: true,
  may2025HourlyRateARS: true,
  may2025MonthlySalaryARS: true,
  jun2025HourlyRateARS: true,
  jun2025MonthlySalaryARS: true,
  jul2025HourlyRateARS: true,
  jul2025MonthlySalaryARS: true,
  aug2025HourlyRateARS: true,
  aug2025MonthlySalaryARS: true,
  sep2025HourlyRateARS: true,
  sep2025MonthlySalaryARS: true,
  oct2025HourlyRateARS: true,
  oct2025MonthlySalaryARS: true,
  nov2025HourlyRateARS: true,
  nov2025MonthlySalaryARS: true,
  dec2025HourlyRateARS: true,
  dec2025MonthlySalaryARS: true,
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
  marginFactor: doublePrecision("margin_factor").default(2.0), // Multiplicador de markup (2x, 2.5x, etc)
  platformCost: doublePrecision("platform_cost").default(0), // Costo de plataforma
  deviationPercentage: doublePrecision("deviation_percentage").default(0), // Porcentaje de desviación
  discountPercentage: doublePrecision("discount_percentage").default(0), // Porcentaje de descuento
  totalAmount: doublePrecision("total_amount").notNull(),
  // Nuevos campos para costos de herramientas y pricing manual
  toolsCost: doublePrecision("tools_cost").default(0), // Costo de herramientas
  priceMode: text("price_mode").default("auto"), // 'auto' | 'manual'
  manualPrice: doublePrecision("manual_price"), // Precio manual cuando priceMode = 'manual'
  adjustmentReason: text("adjustment_reason"),
  additionalNotes: text("additional_notes"),
  status: text("status").notNull().default("draft"), // 'draft', 'pending', 'approved', 'rejected', 'in-negotiation'
  // Campos para proyección inflacionaria
  projectStartDate: timestamp("project_start_date"), // Fecha de inicio del proyecto
  applyInflationAdjustment: boolean("apply_inflation_adjustment").default(false), // Si aplicar ajuste inflacionario
  inflationMethod: text("inflation_method").default("automatic"), // 'automatic' o 'manual'
  manualInflationRate: doublePrecision("manual_inflation_rate"), // Tasa manual si method = 'manual'
  projectedCostARS: doublePrecision("projected_cost_ars"), // Costo proyectado en pesos argentinos
  usdExchangeRate: doublePrecision("usd_exchange_rate"), // Tipo de cambio USD/ARS al momento de cotización
  quotationCurrency: text("quotation_currency").default("ARS"), // 'ARS' o 'USD'
  exchangeRateAtQuote: numeric("exchange_rate_at_quote", { precision: 10, scale: 4 }), // Tipo de cambio al momento de cotizar
  proposalLink: text("proposal_link"), // Link to the proposal document
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Esquema base generado por drizzle-zod
const baseInsertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Esquema personalizado que permite Date, string o undefined para las fechas
export const insertQuotationSchema = baseInsertQuotationSchema.extend({
  projectStartDate: z.union([
    z.date(), 
    z.string().transform((str) => new Date(str)),
    z.undefined(),
    z.null().transform(() => undefined)
  ]).optional(),
  proposalLink: z.string().nullable().optional(),
});

// ==================== HISTORIAL DE NEGOCIACIONES ====================
// Negotiation history table to track all price changes and scope adjustments
export const negotiationHistory = pgTable("negotiation_history", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id),
  previousPrice: doublePrecision("previous_price").notNull(),
  newPrice: doublePrecision("new_price").notNull(),
  previousScope: text("previous_scope"), // JSON string with previous scope details
  newScope: text("new_scope"), // JSON string with new scope details
  previousTeam: text("previous_team"), // JSON string with previous team composition
  newTeam: text("new_team"), // JSON string with new team composition
  changeType: text("change_type").notNull(), // 'price_reduction', 'price_increase', 'scope_reduction', 'scope_expansion', 'team_adjustment', 'mixed'
  clientFeedback: text("client_feedback"), // What the client said about the previous version
  internalNotes: text("internal_notes"), // Internal team notes about the negotiation
  negotiationReason: text("negotiation_reason"), // Why the client is negotiating
  adjustmentPercentage: doublePrecision("adjustment_percentage"), // Percentage change in price
  proposalLink: text("proposal_link"), // Link to the new proposal document
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertNegotiationHistorySchema = createInsertSchema(negotiationHistory).omit({
  id: true,
  createdAt: true,
});

export type NegotiationHistory = typeof negotiationHistory.$inferSelect;
export type InsertNegotiationHistory = z.infer<typeof insertNegotiationHistorySchema>;

// ==================== VARIANTES DE COTIZACIÓN ====================
// Quotation variants table - para manejar múltiples escenarios de precios
export const quotationVariants = pgTable("quotation_variants", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id),
  variantName: text("variant_name").notNull(), // 'Básico', 'Intermedio', 'Full', etc.
  variantDescription: text("variant_description"), // Descripción opcional
  variantOrder: integer("variant_order").notNull().default(1), // Orden de presentación
  baseCost: doublePrecision("base_cost").notNull(),
  complexityAdjustment: doublePrecision("complexity_adjustment").notNull(),
  markupAmount: doublePrecision("markup_amount").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  isSelected: boolean("is_selected").default(false), // Variante seleccionada por el cliente
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuotationVariantSchema = createInsertSchema(quotationVariants).omit({
  id: true,
  createdAt: true,
});

export type QuotationVariant = typeof quotationVariants.$inferSelect;
export type InsertQuotationVariant = z.infer<typeof insertQuotationVariantSchema>;

// ==================== ASIGNACIÓN DE MIEMBROS DE EQUIPO ====================
// Quotation team members junction table
export const quotationTeamMembers = pgTable("quotation_team_members", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  variantId: integer("variant_id").references(() => quotationVariants.id), // Opcional: para asociar a una variante específica
  personnelId: integer("personnel_id"), // Permitir null para asignaciones solo por rol
  roleId: integer("role_id"), // ID del rol (puede ser diferente del rol del personnel)
  hours: doublePrecision("hours").notNull(),
  rate: doublePrecision("rate").notNull(),
  cost: doublePrecision("cost").notNull(),
  fte: doublePrecision("fte"), // Porcentaje en decimales (ej: 0.5 = 50%)
  dedication: doublePrecision("dedication"), // Porcentaje en entero (ej: 50%)
});

export const insertQuotationTeamMemberSchema = createInsertSchema(quotationTeamMembers).omit({
  id: true,
}).extend({
  personnelId: z.number().nullable().optional(),
  quotationId: z.number(),
  variantId: z.number().nullable().optional(),
  roleId: z.number(), // roleId es siempre requerido
  hours: z.number(),
  rate: z.number(),
  cost: z.number()
});

export type QuotationTeamMember = typeof quotationTeamMembers.$inferSelect;
export type InsertQuotationTeamMember = z.infer<typeof insertQuotationTeamMemberSchema>;

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

// ==================== MULTIPLICADORES DE COSTOS ====================
// Tabla para gestionar los multiplicadores de costos del sistema de cotización
export const costMultipliers = pgTable("cost_multipliers", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // 'complexity', 'mentions_volume', 'countries', 'urgency', etc.
  subcategory: text("subcategory").notNull(), // 'basic', 'standard', 'advanced', etc.
  multiplier: doublePrecision("multiplier").notNull().default(1.0), // valor del multiplicador
  label: text("label").notNull(), // etiqueta descriptiva para mostrar en UI
  description: text("description"), // descripción opcional
  isActive: boolean("is_active").notNull().default(true), // para desactivar sin eliminar
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const insertCostMultiplierSchema = createInsertSchema(costMultipliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CostMultiplier = typeof costMultipliers.$inferSelect;
export type InsertCostMultiplier = z.infer<typeof insertCostMultiplierSchema>;

// ==================== INFLACIÓN MENSUAL HISTÓRICA ====================
// Historical monthly inflation data for Argentina
export const monthlyInflation = pgTable("monthly_inflation", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  inflationRate: doublePrecision("inflation_rate").notNull(), // Tasa mensual (ej: 0.08 = 8%)
  source: text("source"), // Fuente del dato (INDEC, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const insertMonthlyInflationSchema = createInsertSchema(monthlyInflation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MonthlyInflation = typeof monthlyInflation.$inferSelect;
export type InsertMonthlyInflation = z.infer<typeof insertMonthlyInflationSchema>;

// ==================== CONFIGURACIÓN DEL SISTEMA ====================
// System configuration for exchange rates and other settings
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  configKey: text("config_key").notNull().unique(), // 'usd_exchange_rate', 'default_inflation_method', etc.
  configValue: doublePrecision("config_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({
  id: true,
  updatedAt: true,
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;

// ==================== TIPOS DE CAMBIO HISTÓRICOS ====================
// Historical exchange rates for USD/ARS - Manual configuration for month-end rates
export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  rate: numeric("rate", { precision: 10, scale: 4 }).notNull(), // Tipo de cambio ARS por 1 USD (ej: 1220.5000)
  rateType: varchar("rate_type", { length: 20 }).notNull().default("end_of_month"), // end_of_month, daily, average
  specificDate: timestamp("specific_date"), // Para tipos de cambio de fechas específicas (opcional)
  notes: text("notes"), // Notas adicionales sobre el tipo de cambio
  source: text("source").default("Manual"), // Fuente del dato (Manual, BCRA, etc.)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  specificDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;

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

  // Campos para subproyectos únicos
  subprojectName: text("subproject_name"), // nombre único del subproyecto (ej: "Informe Mensual Enero")
  completionStatus: text("completion_status").default("pending"), // pending, in_progress, completed, cancelled
  completedDate: timestamp("completed_date"), // fecha de finalización real
  
  // Campo para presupuesto del proyecto
  budget: doublePrecision("budget"), // presupuesto total del proyecto (puede diferir de la cotización)
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
  completedDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  parentProjectId: z.number().optional(),
  isAlwaysOnMacro: z.boolean().optional(),
  macroMonthlyBudget: z.number().optional(),

  // Nuevos campos para entregables
  deliverableFrequency: z.string().optional(), // quincenal, mensual, trimestral, etc.
  deliverableType: z.string().optional(), // tipo de entregable
  deliverableBudget: z.number().optional(), // presupuesto específico para este entregable
  additionalDeliverableCost: z.number().optional(), // costo adicional para entregables fuera de lo planeado
  deliverableDescription: z.string().optional(), // descripción detallada del entregable

  // Nuevos campos para subproyectos únicos
  subprojectName: z.string().optional(), // nombre único del subproyecto
  completionStatus: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  
  // Campo para presupuesto
  budget: z.number().optional(), // presupuesto total del proyecto
});

// ==================== PLANTILLAS DE RECURRENCIA ====================
// Plantillas para generar automáticamente subproyectos recurrentes
export const recurringProjectTemplates = pgTable("recurring_project_templates", {
  id: serial("id").primaryKey(),
  parentProjectId: integer("parent_project_id").notNull().references(() => activeProjects.id),
  templateName: text("template_name").notNull(), // "Informe Mensual", "Reporte Semanal"
  deliverableType: text("deliverable_type").notNull(), // informe_mensual, reporte_semanal
  frequency: text("frequency").notNull(), // monthly, weekly, biweekly
  dayOfMonth: integer("day_of_month"), // Para frecuencia mensual (ej: día 15)
  dayOfWeek: integer("day_of_week"), // Para frecuencia semanal (0=domingo, 1=lunes, etc.)
  estimatedHours: doublePrecision("estimated_hours"),
  baseBudget: doublePrecision("base_budget"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  autoCreateDaysInAdvance: integer("auto_create_days_in_advance").default(7), // Crear X días antes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertRecurringProjectTemplateSchema = createInsertSchema(recurringProjectTemplates).omit({
  id: true,
  createdAt: true,
});

// Asignación de personal a plantillas recurrentes
export const recurringTemplatePersonnel = pgTable("recurring_template_personnel", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => recurringProjectTemplates.id),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  estimatedHours: doublePrecision("estimated_hours"),
  isRequired: boolean("is_required").default(true),
});

export const insertRecurringTemplatePersonnelSchema = createInsertSchema(recurringTemplatePersonnel).omit({
  id: true,
});

// ==================== EQUIPO BASE DEL PROYECTO ====================
// Equipo base asignado al proyecto desde la cotización aprobada
export const projectBaseTeam = pgTable("project_base_team", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  roleId: integer("role_id").notNull().references(() => roles.id),
  estimatedHours: doublePrecision("estimated_hours").notNull(),
  hourlyRate: doublePrecision("hourly_rate").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectBaseTeamSchema = createInsertSchema(projectBaseTeam).omit({
  id: true,
  createdAt: true,
});

export type ProjectBaseTeam = typeof projectBaseTeam.$inferSelect;
export type InsertProjectBaseTeam = z.infer<typeof insertProjectBaseTeamSchema>;

// ==================== PERSONAL NO COTIZADO ====================
// Personal que registra tiempo pero no estaba en la cotización original
export const unquotedPersonnel = pgTable("unquoted_personnel", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  estimatedHours: doublePrecision("estimated_hours").notNull(),
  hourlyRate: doublePrecision("hourly_rate").notNull(),
  assignedDate: timestamp("assigned_date").notNull().defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
  notes: text("notes"),
});

export const insertUnquotedPersonnelSchema = createInsertSchema(unquotedPersonnel).omit({
  id: true,
  assignedDate: true,
});

export type UnquotedPersonnel = typeof unquotedPersonnel.$inferSelect;
export type InsertUnquotedPersonnel = z.infer<typeof insertUnquotedPersonnelSchema>;

// ==================== REGISTRO RÁPIDO DE HORAS ====================
// Registro masivo de horas para el equipo base por períodos
export const quickTimeEntries = pgTable("quick_time_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  periodName: text("period_name").notNull(), // "Enero 2025", "Primera quincena marzo"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("draft"), // draft, submitted, approved
  totalHours: doublePrecision("total_hours").notNull().default(0),
  totalCost: doublePrecision("total_cost").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => users.id),
});

export const insertQuickTimeEntrySchema = createInsertSchema(quickTimeEntries).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  endDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  submittedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  approvedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});

export type QuickTimeEntry = typeof quickTimeEntries.$inferSelect;
export type InsertQuickTimeEntry = z.infer<typeof insertQuickTimeEntrySchema>;

// Detalle de horas por persona en el registro rápido
export const quickTimeEntryDetails = pgTable("quick_time_entry_details", {
  id: serial("id").primaryKey(),
  quickTimeEntryId: integer("quick_time_entry_id").notNull().references(() => quickTimeEntries.id),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  roleId: integer("role_id").notNull().references(() => roles.id),
  hours: doublePrecision("hours").notNull(),
  hourlyRate: doublePrecision("hourly_rate").notNull(),
  totalCost: doublePrecision("total_cost").notNull(),
  description: text("description"),
});

export const insertQuickTimeEntryDetailSchema = createInsertSchema(quickTimeEntryDetails).omit({
  id: true,
});

export type QuickTimeEntryDetail = typeof quickTimeEntryDetails.$inferSelect;
export type InsertQuickTimeEntryDetail = z.infer<typeof insertQuickTimeEntryDetailSchema>;

// ==================== CICLOS DE PROYECTO ====================
// Seguimiento de ciclos mensuales/semanales para proyectos always-on
export const projectCycles = pgTable("project_cycles", {
  id: serial("id").primaryKey(),
  parentProjectId: integer("parent_project_id").notNull().references(() => activeProjects.id),
  templateId: integer("template_id").references(() => recurringProjectTemplates.id),
  cycleName: text("cycle_name").notNull(), // "Enero 2025", "Semana 1 Enero", etc.
  cycleType: text("cycle_type").notNull(), // monthly, weekly, quarterly
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming, active, completed, cancelled
  subprojectId: integer("subproject_id").references(() => activeProjects.id), // Referencia al subproyecto generado
  actualCost: doublePrecision("actual_cost"),
  budgetVariance: doublePrecision("budget_variance"), // Diferencia entre presupuestado y real
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectCycleSchema = createInsertSchema(projectCycles).omit({
  id: true,
  createdAt: true,
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

// ==================== REGISTRO DE HORAS Y COSTOS ====================
// Registro de horas y costos
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  componentId: integer("component_id").references(() => projectComponents.id), // Referencia opcional al componente
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  date: timestamp("date").notNull(),
  hours: doublePrecision("hours").notNull(),
  // Nuevos campos para manejo de costos
  totalCost: doublePrecision("total_cost").notNull(), // Costo total calculado o ingresado
  hourlyRateAtTime: doublePrecision("hourly_rate_at_time").notNull(), // Valor hora al momento del registro (histórico)
  exchangeRateId: integer("exchange_rate_id").references(() => exchangeRates.id), // Referencia al tipo de cambio del mes
  entryType: varchar("entry_type", { length: 20 }).notNull().default("hours"), // "hours" o "cost"
  description: text("description"),
  // Nuevos campos para manejar períodos de tiempo
  isDateRange: boolean("is_date_range").default(false), // Indica si es un período o día específico
  startDate: timestamp("start_date"), // Fecha de inicio del período (opcional)
  endDate: timestamp("end_date"), // Fecha de fin del período (opcional)
  periodDescription: text("period_description"), // Descripción del período (ej: "Enero 2025", "Primera quincena marzo")
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

// Esquema personalizado que permite tanto Date como string para las fechas y valida los nuevos campos
export const insertTimeEntrySchema = baseInsertTimeEntrySchema.extend({
  date: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  approvedDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  endDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  entryType: z.enum(["hours", "cost"]).default("hours"),
  totalCost: z.number().positive("El costo total debe ser positivo"),
  hourlyRateAtTime: z.number().positive("El valor hora debe ser positivo"),
  isDateRange: z.boolean().optional(),
  periodDescription: z.string().optional(),
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

// ==================== AJUSTES HISTÓRICOS DE HORAS ====================
// Tabla para manejar horas estimadas variables por persona y mes
export const monthlyHourAdjustments = pgTable("monthly_hour_adjustments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  adjustedHours: doublePrecision("adjusted_hours").notNull(),
  reason: text("reason"), // Opcional: explicar el motivo del ajuste
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMonthlyHourAdjustmentSchema = createInsertSchema(monthlyHourAdjustments).omit({
  id: true,
  createdAt: true,
});

export type MonthlyHourAdjustment = typeof monthlyHourAdjustments.$inferSelect;
export type InsertMonthlyHourAdjustment = z.infer<typeof insertMonthlyHourAdjustmentSchema>;

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

// Relaciones de multiplicadores de costos
export const costMultipliersRelations = relations(costMultipliers, ({ one }) => ({
  updater: one(users, { fields: [costMultipliers.updatedBy], references: [users.id] }),
}));

// ==================== CONSTANTES Y OPCIONES ====================

// Opciones de metodología de análisis
export const analysisTypes = [
  { value: "basic", label: "Metodología Básica" },
  { value: "standard", label: "Metodología Estándar" },
  { value: "deep", label: "Metodología Avanzada" },
];

// Opciones de tipo de proyecto (modalidad de negocio)
export const projectTypes = [
  { value: "on-demand", label: "On Demand (Proyecto Único)" },
  { value: "fee-mensual", label: "Fee Mensual (Contrato Recurrente)" },
];

// Opciones de duración según tipo de proyecto
export const projectDurationOptions = {
  "on-demand": [
    { value: "3-weeks", label: "3 semanas" },
    { value: "1-month", label: "1 mes" },
    { value: "2-months", label: "2 meses" },
    { value: "3-months", label: "3 meses" },
    { value: "4-months", label: "4 meses" },
    { value: "custom", label: "Personalizada" },
  ],
  "fee-mensual": [
    { value: "6-months", label: "6 meses (mínimo)" },
    { value: "1-year", label: "1 año" },
    { value: "18-months", label: "18 meses" },
    { value: "2-years", label: "2 años" },
    { value: "custom", label: "Personalizada" },
  ],
};

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

// Relaciones de plantillas recurrentes
export const recurringProjectTemplatesRelations = relations(recurringProjectTemplates, ({ one, many }) => ({
  parentProject: one(activeProjects, { fields: [recurringProjectTemplates.parentProjectId], references: [activeProjects.id] }),
  creator: one(users, { fields: [recurringProjectTemplates.createdBy], references: [users.id] }),
  personnel: many(recurringTemplatePersonnel),
  cycles: many(projectCycles),
}));

export const recurringTemplatePersonnelRelations = relations(recurringTemplatePersonnel, ({ one }) => ({
  template: one(recurringProjectTemplates, { fields: [recurringTemplatePersonnel.templateId], references: [recurringProjectTemplates.id] }),
  personnel: one(personnel, { fields: [recurringTemplatePersonnel.personnelId], references: [personnel.id] }),
}));

// Relaciones de ciclos de proyecto
export const projectCyclesRelations = relations(projectCycles, ({ one }) => ({
  parentProject: one(activeProjects, { fields: [projectCycles.parentProjectId], references: [activeProjects.id] }),
  template: one(recurringProjectTemplates, { fields: [projectCycles.templateId], references: [recurringProjectTemplates.id] }),
  subproject: one(activeProjects, { fields: [projectCycles.subprojectId], references: [activeProjects.id] }),
}));

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

// Tipos para las nuevas tablas de recurrencia
export type RecurringProjectTemplate = typeof recurringProjectTemplates.$inferSelect;
export type InsertRecurringProjectTemplate = z.infer<typeof insertRecurringProjectTemplateSchema>;

export type RecurringTemplatePersonnel = typeof recurringTemplatePersonnel.$inferSelect;
export type InsertRecurringTemplatePersonnel = z.infer<typeof insertRecurringTemplatePersonnelSchema>;

export type ProjectCycle = typeof projectCycles.$inferSelect;
export type InsertProjectCycle = z.infer<typeof insertProjectCycleSchema>;

// ==================== HISTORIAL DE TIPOS DE CAMBIO ====================
// Tabla para versionado de tipos de cambio
export const exchangeRateHistory = pgTable("exchange_rate_history", {
  id: serial("id").primaryKey(),
  rate: numeric("rate", { precision: 8, scale: 4 }).notNull(),
  effectiveFrom: timestamp("effective_from").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertExchangeRateHistorySchema = createInsertSchema(exchangeRateHistory).omit({
  id: true,
  createdAt: true,
});

export type ExchangeRateHistory = typeof exchangeRateHistory.$inferSelect;
export type InsertExchangeRateHistory = z.infer<typeof insertExchangeRateHistorySchema>;

export const exchangeRateHistoryRelations = relations(exchangeRateHistory, ({ one }) => ({
  creator: one(users, { fields: [exchangeRateHistory.createdBy], references: [users.id] }),
}));

// Relaciones para costos indirectos
export const indirectCostCategoriesRelations = relations(indirectCostCategories, ({ many }) => ({
  indirectCosts: many(indirectCosts),
  nonBillableHours: many(nonBillableHours),
}));

export const indirectCostsRelations = relations(indirectCosts, ({ one }) => ({
  category: one(indirectCostCategories, { fields: [indirectCosts.categoryId], references: [indirectCostCategories.id] }),
  creator: one(users, { fields: [indirectCosts.createdBy], references: [users.id] }),
}));

export const nonBillableHoursRelations = relations(nonBillableHours, ({ one }) => ({
  personnel: one(personnel, { fields: [nonBillableHours.personnelId], references: [personnel.id] }),
  category: one(indirectCostCategories, { fields: [nonBillableHours.categoryId], references: [indirectCostCategories.id] }),
  creator: one(users, { fields: [nonBillableHours.createdBy], references: [users.id] }),
}));