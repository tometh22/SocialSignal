import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json, numeric, varchar, unique, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
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
  isActive: boolean("is_active").default(true),
  permissions: text("permissions").array().default([]),
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
  categoryId: integer("category_id").notNull().references(() => indirectCostCategories.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default('USD'),
  period: varchar("period", { length: 20 }).notNull(), // 'monthly', 'quarterly', 'annual', 'one-time'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tabla de horas no asignables (reuniones internas, presentaciones comerciales, etc)
export const nonBillableHours = pgTable("non_billable_hours", {
  id: serial("id").primaryKey(),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id, { onDelete: 'cascade' }),
  categoryId: integer("category_id").notNull().references(() => indirectCostCategories.id, { onDelete: 'cascade' }),
  date: timestamp("date").notNull(),
  endDate: timestamp("end_date"), // Optional end date for date ranges
  hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
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

// ==================== AJUSTES P&L (PROVISIONES, IMPUESTOS, OTROS) ====================
export const plAdjustments = pgTable("pl_adjustments", {
  id: serial("id").primaryKey(),
  periodKey: varchar("period_key", { length: 10 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'anticipada', 'impuesto', 'interes', 'otro'
  concept: varchar("concept", { length: 200 }),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlAdjustmentSchema = createInsertSchema(plAdjustments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlAdjustment = typeof plAdjustments.$inferSelect;
export type InsertPlAdjustment = z.infer<typeof insertPlAdjustmentSchema>;

// ==================== MOVIMIENTOS DE CAJA (CASH FLOW REAL) ====================
export const cashMovements = pgTable("cash_movements", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  periodKey: varchar("period_key", { length: 10 }).notNull(),
  bank: varchar("bank", { length: 100 }), // Banco (ej: "Galicia", "ICBC")
  currency: varchar("currency", { length: 20 }), // Moneda original (ej: "ARS", "USD")
  concept: varchar("concept", { length: 300 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).notNull(), // siempre positivo
  type: varchar("type", { length: 10 }).notNull(), // 'IN' = ingreso, 'OUT' = egreso
  category: varchar("category", { length: 100 }), // 'pago_cliente', 'salario', 'proveedor', 'impuesto', etc.
  reference: varchar("reference", { length: 200 }), // invoice number, payment reference
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCashMovementSchema = createInsertSchema(cashMovements).omit({
  id: true,
  createdAt: true,
});

export type CashMovement = typeof cashMovements.$inferSelect;
export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;

// ==================== CLIENTES ====================
// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  logoUrl: varchar("logo_url", { length: 255 }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
});

export const insertClientSchema = createInsertSchema(clients).pick({
  name: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  logoUrl: true,
  createdBy: true,
}).extend({
  createdBy: z.number().int().nullable().optional(),
});

// ==================== ROLES ====================
// Team roles table
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  defaultRate: doublePrecision("default_rate").notNull(),
  defaultRateUsd: doublePrecision("default_rate_usd"),
});

export const insertRoleSchema = createInsertSchema(roles).pick({
  name: true,
  description: true,
  defaultRate: true,
  defaultRateUsd: true,
});

// ==================== PERSONAL ====================
// Team personnel table
export const personnel = pgTable("personnel", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"), // Email opcional
  roleId: integer("role_id").notNull().references(() => roles.id),
  hourlyRate: doublePrecision("hourly_rate").notNull(), // USD per hour
  hourlyRateARS: doublePrecision("hourly_rate_ars"), // ARS per hour for local projects
  contractType: text("contract_type").notNull().default("full-time"), // 'full-time', 'part-time', 'freelance'
  monthlyFixedSalary: doublePrecision("monthly_fixed_salary"), // For full-time employees
  monthlyHours: doublePrecision("monthly_hours").default(160).notNull(), // Standard monthly hours for full-time employees (160 = 8h/day * 20 working days)
  includeInRealCosts: boolean("include_in_real_costs").notNull().default(true), // Whether to include in real cost calculations
  
  // ==================== COSTOS HISTÓRICOS 2025 ====================
  // Enero 2025
  jan2025ContractType: text("jan_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  jan2025HourlyRateARS: doublePrecision("jan_2025_hourly_rate_ars"),
  jan2025MonthlySalaryARS: doublePrecision("jan_2025_monthly_salary_ars"),
  
  // Febrero 2025
  feb2025ContractType: text("feb_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  feb2025HourlyRateARS: doublePrecision("feb_2025_hourly_rate_ars"),
  feb2025MonthlySalaryARS: doublePrecision("feb_2025_monthly_salary_ars"),
  
  // Marzo 2025
  mar2025ContractType: text("mar_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  mar2025HourlyRateARS: doublePrecision("mar_2025_hourly_rate_ars"),
  mar2025MonthlySalaryARS: doublePrecision("mar_2025_monthly_salary_ars"),
  
  // Abril 2025
  apr2025ContractType: text("apr_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  apr2025HourlyRateARS: doublePrecision("apr_2025_hourly_rate_ars"),
  apr2025MonthlySalaryARS: doublePrecision("apr_2025_monthly_salary_ars"),
  
  // Mayo 2025
  may2025ContractType: text("may_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  may2025HourlyRateARS: doublePrecision("may_2025_hourly_rate_ars"),
  may2025MonthlySalaryARS: doublePrecision("may_2025_monthly_salary_ars"),
  
  // Junio 2025
  jun2025ContractType: text("jun_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  jun2025HourlyRateARS: doublePrecision("jun_2025_hourly_rate_ars"),
  jun2025MonthlySalaryARS: doublePrecision("jun_2025_monthly_salary_ars"),
  
  // Julio 2025
  jul2025ContractType: text("jul_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  jul2025HourlyRateARS: doublePrecision("jul_2025_hourly_rate_ars"),
  jul2025MonthlySalaryARS: doublePrecision("jul_2025_monthly_salary_ars"),
  
  // Agosto 2025
  aug2025ContractType: text("aug_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  aug2025HourlyRateARS: doublePrecision("aug_2025_hourly_rate_ars"),
  aug2025MonthlySalaryARS: doublePrecision("aug_2025_monthly_salary_ars"),
  
  // Septiembre 2025
  sep2025ContractType: text("sep_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  sep2025HourlyRateARS: doublePrecision("sep_2025_hourly_rate_ars"),
  sep2025MonthlySalaryARS: doublePrecision("sep_2025_monthly_salary_ars"),
  
  // Octubre 2025
  oct2025ContractType: text("oct_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  oct2025HourlyRateARS: doublePrecision("oct_2025_hourly_rate_ars"),
  oct2025MonthlySalaryARS: doublePrecision("oct_2025_monthly_salary_ars"),
  
  // Noviembre 2025
  nov2025ContractType: text("nov_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
  nov2025HourlyRateARS: doublePrecision("nov_2025_hourly_rate_ars"),
  nov2025MonthlySalaryARS: doublePrecision("nov_2025_monthly_salary_ars"),
  
  // Diciembre 2025
  dec2025ContractType: text("dec_2025_contract_type"), // 'full-time', 'part-time', 'freelance'
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
  // Costos históricos 2025 - Contract Types
  jan2025ContractType: true,
  feb2025ContractType: true,
  mar2025ContractType: true,
  apr2025ContractType: true,
  may2025ContractType: true,
  jun2025ContractType: true,
  jul2025ContractType: true,
  aug2025ContractType: true,
  sep2025ContractType: true,
  oct2025ContractType: true,
  nov2025ContractType: true,
  dec2025ContractType: true,
  // Costos históricos 2025 - Rates and Salaries
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
}).extend({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100, "El nombre no puede exceder 100 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  hourlyRate: z.number().min(0, "La tarifa por hora debe ser positiva"),
  monthlyFixedSalary: z.number().min(0, "El salario mensual debe ser positivo").nullable().optional(),
  monthlyHours: z.number()
    .min(40, "Las horas mensuales deben ser al menos 40")
    .max(300, "Las horas mensuales no pueden exceder 300")
    .int("Las horas mensuales deben ser un número entero")
    .optional(),
  contractType: z.enum(["full-time", "part-time", "freelance"]).default("full-time")
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
  clientId: integer("client_id").notNull().references(() => clients.id),
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
  quotationType: text("quotation_type").default("recurring"), // 'one-time' | 'recurring' | 'fee'
  leadId: integer("lead_id").references(() => crmLeads.id),
  expiresAt: timestamp("expires_at"), // Fecha de expiración (default: 30 días desde creación)
  lossReason: text("loss_reason"), // Motivo de pérdida cuando status='rejected'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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
  quotationId: integer("quotation_id").notNull().references(() => quotations.id),
  variantId: integer("variant_id").references(() => quotationVariants.id), // Opcional: para asociar a una variante específica
  personnelId: integer("personnel_id").references(() => personnel.id), // Permitir null para asignaciones solo por rol
  roleId: integer("role_id").references(() => roles.id), // ID del rol (puede ser diferente del rol del personnel)
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
  roleId: z.number().nullable().optional(),
  hours: z.number(),
  rate: z.number(),
  cost: z.number(),
  fte: z.number().nullable().optional(),
  dedication: z.number().nullable().optional()
});

export type QuotationTeamMember = typeof quotationTeamMembers.$inferSelect;
export type InsertQuotationTeamMember = z.infer<typeof insertQuotationTeamMemberSchema>;

// ==================== TEMPLATES DE COTIZACIÓN ====================
// Quotation templates — configuraciones reutilizables de equipo + scope
export const quotationTemplates = pgTable("quotation_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  projectType: text("project_type").notNull(),
  analysisType: text("analysis_type").notNull(),
  mentionsVolume: text("mentions_volume").notNull().default("medium"),
  countriesCovered: text("countries_covered").notNull().default("1"),
  clientEngagement: text("client_engagement").notNull().default("medium"),
  teamConfig: text("team_config").notNull(), // JSON: array de { roleId, hours, rate, personnelId }
  complexityConfig: text("complexity_config"), // JSON: complexity factor overrides
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuotationTemplateSchema = createInsertSchema(quotationTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type QuotationTemplate = typeof quotationTemplates.$inferSelect;
export type InsertQuotationTemplate = z.infer<typeof insertQuotationTemplateSchema>;

// ==================== ASIGNACIÓN DE ROLES EN PLANTILLAS ====================
// Template Role Assignments table
export const templateRoleAssignments = pgTable("template_role_assignments", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => reportTemplates.id, { onDelete: 'cascade' }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: 'cascade' }),
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
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
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
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
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
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
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
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  specificDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  rateType: z.enum(["end_of_month", "daily", "average", "estimated"]).default("end_of_month"),
  source: z.enum(["Manual", "BCRA", "Blue", "REM", "MEP", "CCL"]).default("Manual"),
});

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;

// ==================== FERIADOS Y DISPONIBILIDAD ====================
export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  name: text("name").notNull(),
  isNational: boolean("is_national").notNull().default(true),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;

// ==================== CIERRE MENSUAL ====================
export const monthlyClosings = pgTable("monthly_closings", {
  id: serial("id").primaryKey(),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  actualHours: doublePrecision("actual_hours").notNull(), // horas reales trabajadas
  adjustedHours: doublePrecision("adjusted_hours").notNull(), // horas ajustadas para facturación (ej: 160)
  hourlyRate: doublePrecision("hourly_rate").notNull(), // valor hora al cierre
  totalCost: doublePrecision("total_cost").notNull(), // adjustedHours * hourlyRate
  notes: text("notes"),
  closedBy: integer("closed_by").references(() => users.id, { onDelete: 'set null' }),
  closedAt: timestamp("closed_at").notNull().defaultNow(),
}, (table) => ({
  uniquePersonMonth: unique("unique_person_month_closing").on(table.personnelId, table.year, table.month),
}));

export const insertMonthlyClosingSchema = createInsertSchema(monthlyClosings).omit({
  id: true,
  closedAt: true,
});

export type MonthlyClosing = typeof monthlyClosings.$inferSelect;
export type InsertMonthlyClosing = z.infer<typeof insertMonthlyClosingSchema>;

// ==================== VALOR HORA ESTIMADO ====================
export const estimatedRates = pgTable("estimated_rates", {
  id: serial("id").primaryKey(),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  estimatedRateARS: doublePrecision("estimated_rate_ars").notNull(),
  adjustmentPct: doublePrecision("adjustment_pct"), // ej: 8.5 para ajuste trimestral
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
}, (table) => ({
  uniquePersonMonthRate: unique("unique_person_month_rate").on(table.personnelId, table.year, table.month),
}));

export const insertEstimatedRateSchema = createInsertSchema(estimatedRates).omit({
  id: true,
  createdAt: true,
});

export type EstimatedRate = typeof estimatedRates.$inferSelect;
export type InsertEstimatedRate = z.infer<typeof insertEstimatedRateSchema>;

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
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),

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
  selectedVariantId: integer("selected_variant_id").references(() => quotationVariants.id), // variante elegida por el cliente

  // Campo para tipo de proyecto (facturable vs interno)
  projectCategory: text("project_category").notNull().default("billable"), // billable, internal

  // Campo para marcar proyectos como terminados/archivados
  isFinished: boolean("is_finished").default(false), // indica si el proyecto ha sido marcado como terminado
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
  expectedEndDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  actualEndDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  completedDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  parentProjectId: z.number().nullable().optional(),
  isAlwaysOnMacro: z.boolean().optional(),
  macroMonthlyBudget: z.number().nullable().optional(),

  // Nuevos campos para entregables
  deliverableFrequency: z.string().nullable().optional(),
  deliverableType: z.string().nullable().optional(),
  deliverableBudget: z.number().nullable().optional(),
  additionalDeliverableCost: z.number().nullable().optional(),
  deliverableDescription: z.string().nullable().optional(),

  // Nuevos campos para subproyectos únicos
  subprojectName: z.string().nullable().optional(),
  completionStatus: z.enum(["pending", "in_progress", "completed", "cancelled"]).nullable().optional(),

  // Campo para presupuesto
  budget: z.number().nullable().optional(),
  selectedVariantId: z.number().nullable().optional(),
  projectCategory: z.enum(["billable", "internal"]).default("billable"),
});

// ==================== PROJECT ALIASES FOR EXCEL MAPPING ====================
// Explicit mapping table for Excel project names to active project IDs
// Replaces fuzzy matching with explicit, reliable mappings
export const projectAliases = pgTable("project_aliases", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  excelClient: varchar("excel_client", { length: 255 }).notNull(), // Client name as it appears in Excel
  excelProject: varchar("excel_project", { length: 255 }).notNull(), // Project name as it appears in Excel
  source: varchar("source", { length: 50 }).notNull().default("migration"), // "migration", "manual", "auto_detected"
  confidence: doublePrecision("confidence").notNull().default(1.0), // 0.0-1.0 confidence score
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"), // Optional notes about this mapping
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  lastMatchedAt: timestamp("last_matched_at"), // When this alias was last used for matching
  matchCount: integer("match_count").notNull().default(0), // How many times this alias has been used
}, (table) => ({
  // Unique constraint to prevent duplicate mappings
  uniqueExcelMapping: unique("unique_excel_mapping").on(table.excelClient, table.excelProject),
}));

export const insertProjectAliasSchema = createInsertSchema(projectAliases).omit({
  id: true,
  createdAt: true,
  lastMatchedAt: true,
  matchCount: true,
});

export type ProjectAlias = typeof projectAliases.$inferSelect;
export type InsertProjectAlias = z.infer<typeof insertProjectAliasSchema>;

// ==================== PERSONNEL ALIASES FOR EXCEL MAPPING ====================
// Explicit mapping table for Excel person names to personnel IDs
// Replaces fuzzy name matching with explicit, reliable mappings
export const personnelAliases = pgTable("personnel_aliases", {
  id: serial("id").primaryKey(),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  excelName: varchar("excel_name", { length: 255 }).notNull().unique(), // Name as it appears in Excel/Sheets
  source: varchar("source", { length: 50 }).notNull().default("manual"), // "manual", "auto_detected"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPersonnelAliasSchema = createInsertSchema(personnelAliases).omit({
  id: true,
  createdAt: true,
});

export type PersonnelAlias = typeof personnelAliases.$inferSelect;
export type InsertPersonnelAlias = z.infer<typeof insertPersonnelAliasSchema>;

// ==================== DIMENSIONAL ALIAS TABLES (SOT ETL V2) ====================

/**
 * dim_client_alias: Alias de clientes para normalización determinística
 * Mapea variaciones del nombre de cliente en Excel → client_id normalizado
 */
export const dimClientAlias = pgTable("dim_client_alias", {
  id: serial("id").primaryKey(),
  aliasNorm: varchar("alias_norm", { length: 255 }).notNull().unique(), // Nombre normalizado (normKey)
  clientId: integer("client_id").references(() => clients.id), // ID del cliente normalizado
  clientRaw: varchar("client_raw", { length: 255 }).notNull(), // Nombre original del Excel
  source: varchar("source", { length: 50 }).notNull().default("manual"), // "manual", "migration", "auto"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDimClientAliasSchema = createInsertSchema(dimClientAlias).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DimClientAlias = typeof dimClientAlias.$inferSelect;
export type InsertDimClientAlias = z.infer<typeof insertDimClientAliasSchema>;

/**
 * dim_project_alias: Alias de proyectos bajo un cliente específico
 * Mapea variaciones del nombre de proyecto + cliente → project_id
 */
export const dimProjectAlias = pgTable("dim_project_alias", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id), // ID del cliente (puede ser null para global)
  aliasNorm: varchar("alias_norm", { length: 255 }).notNull(), // Nombre normalizado del proyecto (normKey)
  projectId: integer("project_id").notNull().references(() => activeProjects.id), // ID del proyecto real
  projectRaw: varchar("project_raw", { length: 255 }).notNull(), // Nombre original del Excel
  source: varchar("source", { length: 50 }).notNull().default("manual"), // "manual", "migration", "auto"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint: client_id + alias_norm debe ser único
  uniqueClientProject: unique("unique_client_project_alias").on(table.clientId, table.aliasNorm),
}));

export const insertDimProjectAliasSchema = createInsertSchema(dimProjectAlias).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DimProjectAlias = typeof dimProjectAlias.$inferSelect;
export type InsertDimProjectAlias = z.infer<typeof insertDimProjectAliasSchema>;

/**
 * rc_unmatched_staging: Staging de filas RC sin match para auditoría
 * Registra todas las filas de Rendimiento Cliente que no pudieron resolverse a un projectId
 */
export const rcUnmatchedStaging = pgTable("rc_unmatched_staging", {
  id: serial("id").primaryKey(),
  periodKey: varchar("period_key", { length: 7 }).notNull(), // YYYY-MM
  clienteRaw: varchar("cliente_raw", { length: 255 }).notNull(),
  proyectoRaw: varchar("proyecto_raw", { length: 255 }).notNull(),
  clienteNorm: varchar("cliente_norm", { length: 255 }).notNull(), // normKey(clienteRaw)
  proyectoNorm: varchar("proyecto_norm", { length: 255 }).notNull(), // normKey(proyectoRaw)
  motivo: varchar("motivo", { length: 100 }).notNull(), // "unknown_client", "unknown_project", "ambiguous_project", "below_threshold"
  fuzzyScore: doublePrecision("fuzzy_score"), // Score del fuzzy match (si aplicó)
  candidateProjectId: integer("candidate_project_id").references(() => activeProjects.id), // Candidato más cercano (si hay)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Index para búsqueda rápida por período
  periodIdx: index("rc_unmatched_period_idx").on(table.periodKey),
}));

export const insertRcUnmatchedStagingSchema = createInsertSchema(rcUnmatchedStaging).omit({
  id: true,
  createdAt: true,
});

export type RcUnmatchedStaging = typeof rcUnmatchedStaging.$inferSelect;
export type InsertRcUnmatchedStaging = z.infer<typeof insertRcUnmatchedStagingSchema>;

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
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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

// ==================== PROYECTOS GOOGLE SHEETS ====================
// Tabla para proyectos importados desde Google Sheets con evolución temporal de precios
export const googleSheetsProjects = pgTable("google_sheets_projects", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(), // Nombre del cliente como aparece en Google Sheets
  projectName: text("project_name").notNull(), // Detalle/nombre del proyecto
  projectType: text("project_type").notNull(), // "One Shot" o "Fee"
  isConfirmed: boolean("is_confirmed").notNull().default(true), // Si/No confirmado
  paymentTerms: integer("payment_terms"), // Condición de pago en días (ej: 90)
  
  // Fechas de creación basadas en primer registro de facturación
  firstBillingMonth: text("first_billing_month"), // "01 ene", "02 feb", etc.
  firstBillingYear: integer("first_billing_year").notNull(),
  createdDate: timestamp("created_date").notNull(), // Fecha calculada desde primer mes
  
  // Precio original (del primer mes de facturación)
  originalCurrency: text("original_currency").notNull(), // "ARS" o "USD"
  originalAmountARS: doublePrecision("original_amount_ars"), 
  originalAmountUSD: doublePrecision("original_amount_usd"),
  
  // Precio actual (último registrado)
  currentAmountARS: doublePrecision("current_amount_ars"),
  currentAmountUSD: doublePrecision("current_amount_usd"),
  
  // Control de importación
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  googleSheetsKey: text("google_sheets_key").notNull(), // cliente + proyecto para identificar únicos
});

// Tabla para registros mensuales de facturación (evolución temporal)
export const googleSheetsProjectBilling = pgTable("google_sheets_project_billing", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => googleSheetsProjects.id),
  
  // Información temporal
  billingMonth: text("billing_month").notNull(), // "01 ene", "02 feb"
  billingYear: integer("billing_year").notNull(),
  collectionMonth: text("collection_month"), // Mes cobro si está disponible
  collectionYear: integer("collection_year"),
  
  // Montos del mes específico
  amountARS: doublePrecision("amount_ars"),
  amountUSD: doublePrecision("amount_usd"),
  
  // Información adicional
  adjustment: doublePrecision("adjustment").default(0),
  baseValue: doublePrecision("base_value"),
  invoiced: boolean("invoiced").default(false), // Facturado/No Facturado
  
  // Control
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGoogleSheetsProjectSchema = createInsertSchema(googleSheetsProjects).omit({
  id: true,
  importedAt: true,
  lastUpdated: true,
}).extend({
  createdDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertGoogleSheetsProjectBillingSchema = createInsertSchema(googleSheetsProjectBilling).omit({
  id: true,
  createdAt: true,
});

export type GoogleSheetsProject = typeof googleSheetsProjects.$inferSelect;
export type InsertGoogleSheetsProject = z.infer<typeof insertGoogleSheetsProjectSchema>;
export type GoogleSheetsProjectBilling = typeof googleSheetsProjectBilling.$inferSelect;
export type InsertGoogleSheetsProjectBilling = z.infer<typeof insertGoogleSheetsProjectBillingSchema>;
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
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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
  submittedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  approvedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
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
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
});

// Esquema base generado por drizzle-zod
const baseInsertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

// Esquema personalizado que permite tanto Date como string para las fechas y valida los nuevos campos
export const insertTimeEntrySchema = baseInsertTimeEntrySchema.extend({
  date: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  approvedDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  endDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  componentId: z.number().nullable().optional(),
  hours: z.number().min(0.25, "El mínimo son 15 minutos (0.25 horas)"),
  entryType: z.enum(["hours", "cost"]).default("hours"),
  totalCost: z.number().positive("El costo total debe ser positivo"),
  hourlyRateAtTime: z.number().positive("El valor hora debe ser positivo"),
  isDateRange: z.boolean().optional(),
  periodDescription: z.string().nullable().optional(),
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

// ==================== AJUSTES DE PRECIO DE PROYECTO ====================
// Tabla para registrar cambios de precio al cliente durante la ejecución del proyecto
export const projectPriceAdjustments = pgTable("project_price_adjustments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  previousPrice: doublePrecision("previous_price").notNull(),
  newPrice: doublePrecision("new_price").notNull(),
  adjustmentPercentage: doublePrecision("adjustment_percentage").notNull(), // Porcentaje de cambio
  effectiveDate: timestamp("effective_date").notNull(), // A partir de qué fecha aplica el nuevo precio
  reason: text("reason").notNull(), // Motivo del cambio de precio
  changeType: varchar("change_type", { length: 50 }).notNull(), // 'increase', 'decrease', 'scope_change', 'market_adjustment'
  clientNotified: boolean("client_notified").notNull().default(false), // Si se notificó al cliente
  clientApproval: boolean("client_approval"), // Aprobación del cliente (null = pendiente)
  approvalDate: timestamp("approval_date"), // Fecha de aprobación del cliente
  notes: text("notes"), // Notas adicionales sobre el cambio
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectPriceAdjustmentSchema = createInsertSchema(projectPriceAdjustments).omit({
  id: true,
  createdAt: true,
}).extend({
  effectiveDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  approvalDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
});

export type ProjectPriceAdjustment = typeof projectPriceAdjustments.$inferSelect;
export type InsertProjectPriceAdjustment = z.infer<typeof insertProjectPriceAdjustmentSchema>;

// ==================== SISTEMA DE CHAT ====================
// Tabla de conversaciones
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }),
  isGroup: boolean("is_group").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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

// ==================== MÓDULO DE GESTIÓN DE TAREAS ====================
// Tabla principal de tareas (similar a Asana)
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  projectId: integer("project_id"),
  sectionName: text("section_name").default("General"),
  assigneeId: integer("assignee_id").references(() => personnel.id),
  collaboratorIds: jsonb("collaborator_ids").$type<number[]>().default([]),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  estimatedHours: doublePrecision("estimated_hours"),
  loggedHours: doublePrecision("logged_hours").default(0),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  parentTaskId: integer("parent_task_id"),
  position: integer("position").default(0),
  completedAt: timestamp("completed_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  loggedHours: true,
}).extend({
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional().nullable(),
  dueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional().nullable(),
  completedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional().nullable(),
  collaboratorIds: z.array(z.number()).optional().default([]),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// Registro de horas contra tareas específicas
export const taskTimeEntries = pgTable("task_time_entries", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  date: timestamp("date").notNull(),
  hours: doublePrecision("hours").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskTimeEntrySchema = createInsertSchema(taskTimeEntries).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  hours: z.number().min(0.25, "El mínimo son 15 minutos (0.25 horas)"),
});

export type TaskTimeEntry = typeof taskTimeEntries.$inferSelect;
export type InsertTaskTimeEntry = z.infer<typeof insertTaskTimeEntrySchema>;

// Miembros asignados a proyectos dentro del módulo de tareas
export const taskProjectMembers = pgTable("task_project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskProjectMemberSchema = createInsertSchema(taskProjectMembers).omit({
  id: true,
  createdAt: true,
});

export type TaskProjectMember = typeof taskProjectMembers.$inferSelect;
export type InsertTaskProjectMember = z.infer<typeof insertTaskProjectMemberSchema>;

// Standalone task projects (without an active_project base)
export const taskOwnProjects = pgTable("task_own_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  colorIndex: integer("color_index").notNull().default(0),
  privacy: text("privacy").notNull().default("team"),
  createdByPersonnelId: integer("created_by_personnel_id").references(() => personnel.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskOwnProjectSchema = createInsertSchema(taskOwnProjects).omit({
  id: true,
  createdAt: true,
});

export type TaskOwnProject = typeof taskOwnProjects.$inferSelect;
export type InsertTaskOwnProject = z.infer<typeof insertTaskOwnProjectSchema>;

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

// Relaciones de personal (removed duplicate, kept the complete version below)



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
  client: one(clients, { fields: [activeProjects.clientId], references: [clients.id] }),
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
  reworkRequired: boolean("rework_required").default(false), // Estandarizado: si requirió retrabajo
  narrativeQuality: numeric("narrative_quality", { precision: 3, scale: 2 }),
  graphicsEffectiveness: numeric("graphics_effectiveness", { precision: 3, scale: 2 }),
  formatDesign: numeric("format_design", { precision: 3, scale: 2 }),
  relevantInsights: numeric("relevant_insights", { precision: 3, scale: 2 }),
  operationsFeedback: numeric("operations_feedback", { precision: 3, scale: 2 }),
  hoursEstimated: numeric("hours_estimated", { precision: 5, scale: 2 }),
  hoursActual: numeric("hours_actual", { precision: 5, scale: 2 }),
  clientFeedback: numeric("client_feedback", { precision: 3, scale: 2 }),
  clientGeneralFeedback: numeric("client_general_feedback", { precision: 3, scale: 2 }), // Estandarizado: feedback general del cliente (escala 1-5)
  briefCompliance: numeric("brief_compliance", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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
  totalScore: numeric("total_score", { precision: 4, scale: 2 }).notNull().default('0'),
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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

// ==================== GESTIÓN FINANCIERA Y VENTAS ====================

// Tabla de registros de ingresos mensuales por proyecto
export const projectMonthlyRevenue = pgTable("project_monthly_revenue", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  
  // Datos financieros
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }).notNull(),
  amountArs: numeric("amount_ars", { precision: 15, scale: 2 }),
  exchangeRate: numeric("exchange_rate", { precision: 8, scale: 4 }),
  
  // Estados de proceso
  invoiced: boolean("invoiced").default(false), // Si se facturó (columna S)
  invoiceDate: timestamp("invoice_date"), // Fecha real de facturación
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  
  collected: boolean("collected").default(false), // Si se cobró
  collectionDate: timestamp("collection_date"), // Fecha real de cobro (columna C)
  
  // Metadatos
  revenueSource: varchar("revenue_source", { length: 50 }).notNull().default('manual'), // 'manual', 'google_sheets', 'automated'
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

// Tabla de cambios de pricing por proyecto (para manejar casos como Warner)
export const projectPricingChanges = pgTable("project_pricing_changes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  
  // Período de vigencia
  effectiveFromYear: integer("effective_from_year").notNull(),
  effectiveFromMonth: integer("effective_from_month").notNull(),
  effectiveToYear: integer("effective_to_year"), // null = vigente
  effectiveToMonth: integer("effective_to_month"),
  
  // Pricing
  monthlyAmountUsd: numeric("monthly_amount_usd", { precision: 12, scale: 2 }).notNull(),
  monthlyAmountArs: numeric("monthly_amount_ars", { precision: 15, scale: 2 }),
  
  // Contexto del cambio
  changeReason: text("change_reason"), // "Scope expansion", "Contract renewal", etc.
  scopeDescription: text("scope_description"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

// ==================== NUEVAS TABLAS PARA SEPARAR ANÁLISIS OPERACIONAL Y FINANCIERO ====================

// Tabla de VENTAS OPERACIONALES MENSUALES (para análisis operacional en proyectos)
export const projectMonthlySales = pgTable("project_monthly_sales", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  
  // Ventas operacionales (reconocimiento de ingresos por servicios prestados)
  salesAmountUsd: numeric("sales_amount_usd", { precision: 12, scale: 2 }).notNull(),
  salesAmountArs: numeric("sales_amount_ars", { precision: 15, scale: 2 }),
  
  // Metadatos operacionales
  salesType: varchar("sales_type", { length: 50 }).notNull(), // 'monthly_fee', 'milestone', 'deliverable'
  description: text("description"), // Descripción del servicio prestado
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

// Tabla de FACTURACIÓN Y COBRANZA (para análisis financiero real)
export const projectFinancialTransactions = pgTable("project_financial_transactions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  
  // Datos de facturación
  invoiceNumber: varchar("invoice_number", { length: 100 }),
  invoiceDate: timestamp("invoice_date"),
  invoiceAmountUsd: numeric("invoice_amount_usd", { precision: 12, scale: 2 }),
  invoiceAmountArs: numeric("invoice_amount_ars", { precision: 15, scale: 2 }),
  
  // Datos de cobranza
  collectionDate: timestamp("collection_date"),
  collectedAmountUsd: numeric("collected_amount_usd", { precision: 12, scale: 2 }),
  collectedAmountArs: numeric("collected_amount_ars", { precision: 15, scale: 2 }),
  
  // Información adicional
  paymentMethod: varchar("payment_method", { length: 50 }), // 'wire_transfer', 'check', 'cash', etc.
  exchangeRateUsed: numeric("exchange_rate_used", { precision: 8, scale: 4 }),
  notes: text("notes"),
  
  // Estados
  invoiceStatus: varchar("invoice_status", { length: 30 }).notNull().default('pending'), // 'pending', 'sent', 'paid', 'overdue'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

// Vista de resumen financiero por proyecto
export const projectFinancialSummary = pgTable("project_financial_summary", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id).unique(),
  
  // Totales acumulados
  totalRevenueUsd: numeric("total_revenue_usd", { precision: 12, scale: 2 }).default('0'),
  totalInvoicedUsd: numeric("total_invoiced_usd", { precision: 12, scale: 2 }).default('0'),
  totalCollectedUsd: numeric("total_collected_usd", { precision: 12, scale: 2 }).default('0'),
  
  // Estado actual
  currentMonthlyRateUsd: numeric("current_monthly_rate_usd", { precision: 12, scale: 2 }),
  lastRevenueMonth: integer("last_revenue_month"),
  lastRevenueYear: integer("last_revenue_year"),
  
  // Indicadores
  outstandingInvoicesUsd: numeric("outstanding_invoices_usd", { precision: 12, scale: 2 }).default('0'),
  pendingCollectionUsd: numeric("pending_collection_usd", { precision: 12, scale: 2 }).default('0'),
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
});

// ==================== IMPORTACIÓN VENTAS GOOGLE SHEETS ====================
// Tabla para importar datos de la pestaña "Ventas Tomi"
export const googleSheetsSales = pgTable("google_sheets_sales", {
  id: serial("id").primaryKey(),
  
  // Clave temporal única (YYYY-MM) para simplificar JOINs
  monthKey: varchar("month_key", { length: 7 }).notNull(), // "2025-08"
  
  // Datos desde Google Sheets
  clientName: varchar("client_name", { length: 200 }).notNull(),
  projectName: varchar("project_name", { length: 200 }).notNull(),
  month: varchar("month", { length: 50 }).notNull(), // "Enero", "Febrero", etc.
  year: integer("year").notNull(),
  salesType: varchar("sales_type", { length: 50 }).notNull(), // "Fee", "One Shot"
  
  // Monedas y FX mejorados
  amountLocal: numeric("amount_local", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).notNull().default('ARS'),
  fxApplied: numeric("fx_applied", { precision: 10, scale: 4 }),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }),
  fxSource: varchar("fx_source", { length: 50 }), // "Excel", "Manual", "API"
  fxAt: timestamp("fx_at"),
  
  // Revenue vs cobro
  revenueType: varchar("revenue_type", { length: 20 }).notNull().default('fee'), // "fee", "T&M", "credito"
  status: varchar("status", { length: 20 }).notNull().default('emitido'), // "proyectado", "emitido", "cobrado"
  recognizedMonth: varchar("recognized_month", { length: 7 }), // Month when revenue is recognized
  confirmed: varchar("confirmed", { length: 10 }).notNull().default('SI'), // "SI", "NO"
  
  // Campos calculados automáticamente
  monthNumber: integer("month_number"), // 1-12
  
  // Referencias al sistema (null si no existe match)
  clientId: integer("client_id").references(() => clients.id),
  projectId: integer("project_id").references(() => activeProjects.id),
  
  // Metadatos de importación
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  rowNumber: integer("row_number"), // Fila en el Excel para debugging
  importBatch: varchar("import_batch", { length: 100 }), // ID del batch de importación
  
  // Control de duplicados
  uniqueKey: varchar("unique_key", { length: 500 }).notNull().unique(), // client_project_month_year_type
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Esquemas de inserción
export const insertProjectMonthlyRevenueSchema = createInsertSchema(projectMonthlyRevenue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectPricingChangesSchema = createInsertSchema(projectPricingChanges).omit({
  id: true,
  createdAt: true,
});

export const insertProjectFinancialSummarySchema = createInsertSchema(projectFinancialSummary).omit({
  id: true,
  updatedAt: true,
});

// Esquemas para las nuevas tablas de análisis operacional y financiero
export const insertProjectMonthlySalesSchema = createInsertSchema(projectMonthlySales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectFinancialTransactionSchema = createInsertSchema(projectFinancialTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Esquema para importación de ventas desde Google Sheets
export const insertGoogleSheetsSalesSchema = createInsertSchema(googleSheetsSales).omit({
  id: true,
  importedAt: true,
  lastUpdated: true,
  createdAt: true,
});

// Tipos
export type ProjectMonthlyRevenue = typeof projectMonthlyRevenue.$inferSelect;
export type InsertProjectMonthlyRevenue = z.infer<typeof insertProjectMonthlyRevenueSchema>;

export type ProjectPricingChange = typeof projectPricingChanges.$inferSelect;
export type InsertProjectPricingChange = z.infer<typeof insertProjectPricingChangesSchema>;

export type ProjectFinancialSummary = typeof projectFinancialSummary.$inferSelect;
export type InsertProjectFinancialSummary = z.infer<typeof insertProjectFinancialSummarySchema>;

// Tipos para las nuevas tablas
export type ProjectMonthlySales = typeof projectMonthlySales.$inferSelect;
export type InsertProjectMonthlySales = z.infer<typeof insertProjectMonthlySalesSchema>;

export type ProjectFinancialTransaction = typeof projectFinancialTransactions.$inferSelect;
export type InsertProjectFinancialTransaction = z.infer<typeof insertProjectFinancialTransactionSchema>;

// Tipos para ventas de Google Sheets
export type GoogleSheetsSales = typeof googleSheetsSales.$inferSelect;
export type InsertGoogleSheetsSales = z.infer<typeof insertGoogleSheetsSalesSchema>;

// Interface para endpoint de income dashboard (replicando patrón de cost dashboard)
// 💰 EXTENDED for multi-currency system
export interface IncomeRecord {
  id: number;
  client_name: string;
  project_name: string;
  amount_usd: number;
  original_amount: number; // 💰 NEW: Original amount in source currency
  currency: 'USD' | 'ARS';  // 💰 NEW: Source currency for display
  month_key: string;
  revenue_type: 'fee' | 'project' | 'bonus';
  status: 'completada' | 'pendiente' | 'proyectada';
  confirmed: string;
}

// Relaciones de ingresos mensuales de proyectos
export const projectMonthlyRevenueRelations = relations(projectMonthlyRevenue, ({ one }) => ({
  project: one(activeProjects, { fields: [projectMonthlyRevenue.projectId], references: [activeProjects.id] }),
  creator: one(users, { fields: [projectMonthlyRevenue.createdBy], references: [users.id] }),
}));

// Relaciones de cambios de pricing de proyectos
export const projectPricingChangesRelations = relations(projectPricingChanges, ({ one }) => ({
  project: one(activeProjects, { fields: [projectPricingChanges.projectId], references: [activeProjects.id] }),
  creator: one(users, { fields: [projectPricingChanges.createdBy], references: [users.id] }),
}));

// Relaciones de resumen financiero de proyectos
export const projectFinancialSummaryRelations = relations(projectFinancialSummary, ({ one }) => ({
  project: one(activeProjects, { fields: [projectFinancialSummary.projectId], references: [activeProjects.id] }),
  updater: one(users, { fields: [projectFinancialSummary.updatedBy], references: [users.id] }),
}));

// Relaciones para las nuevas tablas
export const projectMonthlySalesRelations = relations(projectMonthlySales, ({ one }) => ({
  project: one(activeProjects, { fields: [projectMonthlySales.projectId], references: [activeProjects.id] }),
  creator: one(users, { fields: [projectMonthlySales.createdBy], references: [users.id] }),
}));

export const projectFinancialTransactionsRelations = relations(projectFinancialTransactions, ({ one }) => ({
  project: one(activeProjects, { fields: [projectFinancialTransactions.projectId], references: [activeProjects.id] }),
  creator: one(users, { fields: [projectFinancialTransactions.createdBy], references: [users.id] }),
}));

// ==================== COSTOS DIRECTOS EXCEL ====================
// Tabla para importar costos directos desde la pestaña "Costos directos e indirectos"
export const directCosts = pgTable("direct_costs", {
  id: serial("id").primaryKey(),
  
  // Clave temporal única (YYYY-MM) para simplificar JOINs
  monthKey: varchar("month_key", { length: 7 }).notNull(), // "2025-08"
  
  // Datos desde Excel "Costos directos e indirectos"
  persona: text("persona").notNull(),
  rol: text("rol"), // Rol de la persona en el proyecto
  mes: text("mes").notNull(),
  año: integer("año").notNull(),
  tipoGasto: text("tipo_gasto"), // "Directo", "Indirecto"
  especificacion: text("especificacion"), // PRO00003734, etc.
  proyecto: text("proyecto"), // Fee mensual, Especial, General
  tipoProyecto: text("tipo_proyecto"), // Fee mensual, Especial
  cliente: text("cliente"), // Warner, Uber, Epical, etc.
  
  // Datos de horas y costos - INCLUYENDO COLUMNA M
  horasObjetivo: doublePrecision("horas_objetivo"), // Columna K: Cantidad de horas objetivo
  horasRealesAsana: doublePrecision("horas_reales_asana").notNull(), // Columna L: Cantidad de horas reales Asana
  horasParaFacturacion: doublePrecision("horas_para_facturacion"), // Columna M: NUEVO - horas para facturación
  valorHoraLocalCurrency: numeric("valor_hora_local_currency", { precision: 10, scale: 2 }), // Valor hora en moneda local
  valorHoraPersona: doublePrecision("valor_hora_persona").notNull(), // Obtenido de personnel histórico
  costoTotal: doublePrecision("costo_total").notNull(), // horas * valor_hora
  
  // Conversión de moneda desde Excel MAESTRO mejorada
  tipoCambio: numeric("tipo_cambio", { precision: 10, scale: 4 }), // Columna P: Tipo de cambio del momento
  fxCost: numeric("fx_cost", { precision: 10, scale: 4 }), // Costo de conversión
  montoTotalUSD: numeric("monto_total_usd", { precision: 12, scale: 2 }), // Columna Q: Monto ya convertido a USD
  
  // Referencias al sistema (null si no existe match)
  projectId: integer("project_id").references(() => activeProjects.id),
  personnelId: integer("personnel_id").references(() => personnel.id),
  
  // Metadatos de importación
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  rowNumber: integer("row_number"), // Fila en el Excel para debugging
  importBatch: varchar("import_batch", { length: 100 }), // ID del batch de importación
  
  // Control de duplicados
  uniqueKey: varchar("unique_key", { length: 500 }).notNull().unique(), // persona_proyecto_cliente_mes_año
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDirectCostSchema = createInsertSchema(directCosts).omit({
  id: true,
  importedAt: true,
  lastUpdated: true,
  createdAt: true,
});

export type DirectCost = typeof directCosts.$inferSelect;
export type InsertDirectCost = z.infer<typeof insertDirectCostSchema>;

// Relaciones de costos directos
export const directCostsRelations = relations(directCosts, ({ one }) => ({
  project: one(activeProjects, { fields: [directCosts.projectId], references: [activeProjects.id] }),
  personnel: one(personnel, { fields: [directCosts.personnelId], references: [personnel.id] }),
}));

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
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
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
}).extend({
  npsScore: z.number().int().min(0).max(10).nullable().optional(),
  reportQuality: z.number().int().min(0).max(10).nullable().optional(),
  insightsClarity: z.number().int().min(0).max(10).nullable().optional(),
  briefObjectives: z.number().int().min(0).max(10).nullable().optional(),
  reportPresentation: z.number().int().min(0).max(10).nullable().optional(),
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

// ==================== COSTOS HISTÓRICOS DE PERSONAL NORMALIZADOS ====================
// Tabla normalizada para costos históricos de personal (reemplaza campos repetitivos)
export const personnelHistoricalCosts = pgTable("personnel_historical_costs", {
  id: serial("id").primaryKey(),
  personnelId: integer("personnel_id").notNull().references(() => personnel.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  hourlyRateARS: numeric("hourly_rate_ars", { precision: 10, scale: 2 }),
  monthlySalaryARS: numeric("monthly_salary_ars", { precision: 12, scale: 2 }),
  hourlyRateUSD: numeric("hourly_rate_usd", { precision: 10, scale: 2 }),
  monthlySalaryUSD: numeric("monthly_salary_usd", { precision: 12, scale: 2 }),
  exchangeRateId: integer("exchange_rate_id").references(() => exchangeRates.id),
  adjustmentReason: text("adjustment_reason"), // Razón del ajuste (inflación, promoción, etc.)
  notes: text("notes"), // Notas adicionales
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
});

export const insertPersonnelHistoricalCostSchema = createInsertSchema(personnelHistoricalCosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PersonnelHistoricalCost = typeof personnelHistoricalCosts.$inferSelect;
export type InsertPersonnelHistoricalCost = z.infer<typeof insertPersonnelHistoricalCostSchema>;

// ==================== HISTORIAL DE TIPOS DE CAMBIO ====================
// Tabla para versionado de tipos de cambio
export const exchangeRateHistory = pgTable("exchange_rate_history", {
  id: serial("id").primaryKey(),
  rate: numeric("rate", { precision: 8, scale: 4 }).notNull(),
  effectiveFrom: timestamp("effective_from").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
});

export const insertExchangeRateHistorySchema = createInsertSchema(exchangeRateHistory).omit({
  id: true,
  createdAt: true,
});

export type ExchangeRateHistory = typeof exchangeRateHistory.$inferSelect;
export type InsertExchangeRateHistory = z.infer<typeof insertExchangeRateHistorySchema>;

// Relaciones para costos históricos de personal
export const personnelHistoricalCostsRelations = relations(personnelHistoricalCosts, ({ one }) => ({
  personnel: one(personnel, { fields: [personnelHistoricalCosts.personnelId], references: [personnel.id] }),
  exchangeRate: one(exchangeRates, { fields: [personnelHistoricalCosts.exchangeRateId], references: [exchangeRates.id] }),
  creator: one(users, { fields: [personnelHistoricalCosts.createdBy], references: [users.id] }),
  updater: one(users, { fields: [personnelHistoricalCosts.updatedBy], references: [users.id] }),
}));

// Actualizar relaciones de personal para incluir costos históricos
export const personnelRelations = relations(personnel, ({ one, many }) => ({
  role: one(roles, { fields: [personnel.roleId], references: [roles.id] }),
  quotationTeamMembers: many(quotationTeamMembers),
  historicalCosts: many(personnelHistoricalCosts), // Nueva relación
}));

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

// ==================== ACTIVE PROJECTS API CONTRACTS ====================
// Unified contracts for "Proyectos Activos" page according to blueprint specification

// TimeFilter union type - exact specification from blueprint
export const timeFilterSchema = z.union([
  z.literal('this_month'),
  z.literal('last_month'),
  z.literal('current_month'),
  z.literal('mes_pasado'),
  z.literal('este_mes'),
  z.literal('agosto_2025'),
  z.literal('julio_2025'),
  z.literal('septiembre_2025'),
  z.literal('q1_2025'),
  z.literal('q2_2025'), 
  z.literal('q3_2025'),
  z.literal('q4_2025'),
  z.literal('this_quarter'),
  z.literal('last_quarter'),
  z.literal('this_year'),
  z.literal('last_year'),
  z.string().regex(/^month_\d+_\d{4}$/), // month_8_2025
  z.string().regex(/^q\d_\d{4}$/),       // q1_2024  
  z.string().regex(/^agosto_\d{4}$/),    // agosto_2025
  z.string().regex(/^julio_\d{4}$/),     // julio_2025
  z.string().regex(/^[a-z]+_\d{4}$/),    // any_month_year
  z.object({
    start: z.string(),  // ISO format YYYY-MM-DD
    end: z.string()     // ISO format YYYY-MM-DD  
  })
]);

export type TimeFilter = z.infer<typeof timeFilterSchema>;

// ResolvedPeriod - exact specification from blueprint with dual currency support
export const resolvedPeriodSchema = z.object({
  start: z.string(),  // ISO format YYYY-MM-DD
  end: z.string(),    // ISO format YYYY-MM-DD
  label: z.string(),   // Human-readable label
  
  // 🚀 DUAL CURRENCY FIELDS for native display
  displayCurrency: z.enum(["ARS", "USD"]).optional().nullable(), // Original currency detected
  revenueDisplay: z.number().optional().nullable(),              // Amount in native currency
  
  // FX Rate metadata from Star Schema fact_labor_month
  fxRate: z.number().optional().nullable(),        // Weighted FX rate for period
  fxType: z.string().optional(),                   // 'weighted' | 'fixed'
  fxFormula: z.string().optional(),                // Formula used for calculation
  fxSource: z.string().optional()                  // Data source description
});

export type ResolvedPeriod = z.infer<typeof resolvedPeriodSchema>;

// Dual-currency display type (structured approach from user suggestions)
export const moneyDisplaySchema = z.object({
  amount: z.number(),
  currency: z.enum(["ARS", "USD"])
});

export type MoneyDisplay = z.infer<typeof moneyDisplaySchema>;

// ProjectMetrics - updated with dual currency support (user suggestions implemented)
export const projectMetricsSchema = z.object({
  revenueUSD: z.number(),             // Legacy compatibility (USD normalized)
  costUSD: z.number(), 
  profitUSD: z.number(),              // revenue - cost
  markupRatio: z.number().nullable(), // revenue / cost (show as "×")
  marginFrac: z.number().nullable(),  // profit / revenue (0..1, show as %)
  workedHours: z.number(),
  targetHours: z.number(),
  efficiencyFrac: z.number().nullable(), // worked / target (0..1, show as %)
  
  // 🚀 DUAL CURRENCY FIELDS: Native display + USD for KPIs
  revenueUSDNormalized: z.number(),                    // Amount normalized to USD for ALL calculations
  revenueDisplay: moneyDisplaySchema.optional(),       // Structured display: {amount, currency}
  costUSDNormalized: z.number().optional(),            // Amount normalized to USD for calculations
  costDisplay: moneyDisplaySchema.optional()           // Structured display: {amount, currency}
});

export type ProjectMetrics = z.infer<typeof projectMetricsSchema>;

// Project flags - exact specification from blueprint
export const projectFlagsSchema = z.object({
  hasSales: z.boolean(),
  hasCosts: z.boolean(),
  hasHours: z.boolean()
});

export type ProjectFlags = z.infer<typeof projectFlagsSchema>;

// Portfolio summary - updated with correct semantics
export const portfolioSummarySchema = z.object({
  totalProjects: z.number(),
  activeProjects: z.number(),
  periodRevenueUSD: z.number(),
  periodCostUSD: z.number(),
  periodProfitUSD: z.number(),         // revenue - cost
  periodWorkedHours: z.number(),
  efficiencyFrac: z.number().nullable(), // aggregate efficiency if applicable
  markupRatio: z.number().nullable(),   // aggregate markup ratio
  // 🚀 DUAL CURRENCY FIELDS at portfolio level
  displayCurrency: z.enum(["ARS", "USD"]).optional().nullable(), // Dominant currency in portfolio
  revenueDisplay: z.number().optional().nullable(),              // Total revenue in display currency
  // Star Schema extensions
  periodAvgMarginPercent: z.number().optional(),     // Average margin percentage across portfolio
  periodAsanaHours: z.number().optional(),           // Actual hours from Asana
  periodBillingHours: z.number().optional(),         // Billing hours
  periodTargetHours: z.number().optional(),          // Target hours
  billableRate: z.number().optional(),               // (billingHours / asanaHours) * 100
  dataFreshness: z.string().nullable().optional()    // Timestamp of last ETL load
});

export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;

// Individual project in response - exact specification from blueprint
export const activeProjectItemSchema = z.object({
  projectId: z.number(),
  clientId: z.number(),
  name: z.string(),
  type: z.enum(['fee', 'one-shot', 'other']),
  status: z.enum(['active', 'paused', 'completed']),
  client: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().nullable()
  }),
  metrics: projectMetricsSchema,
  // Frontend compatibility fields - map from metrics
  revenue: z.number().nullable(),
  cost: z.number().nullable(),
  profit: z.number().nullable(),
  periodRevenueUSD: z.number().nullable(),
  periodCostUSD: z.number().nullable(),
  periodProfitUSD: z.number().nullable(),
  flags: projectFlagsSchema,
  period: resolvedPeriodSchema,
  // Optional metadata for intelligent visibility and project management
  projectType: z.enum(['Fee', 'Puntual']).optional(),
  isOneShot: z.boolean().optional(),     // True if quotationType is 'one-time'
  // One-shot specific lifetime metrics (for display in list view)
  lifetimeRevenueUSD: z.number().optional(),  // Total revenue across all periods
  lifetimeCostUSD: z.number().optional(),     // Total cost across all periods
  revenuePeriod: z.string().optional(),       // Period with revenue (YYYY-MM)
  startMonthKey: z.string().optional(),  // YYYY-MM
  endMonthKey: z.string().optional(),    // YYYY-MM
  lastActivity: z.string().optional(),   // YYYY-MM
  isFinished: z.boolean().optional(),
  supportsRollup: z.boolean().optional(),
  allowFinish: z.boolean().optional()
});

export type ActiveProjectItem = z.infer<typeof activeProjectItemSchema>;

// Complete ActiveProjectsResponse - new simplified structure
export const activeProjectsResponseSchema = z.object({
  period: resolvedPeriodSchema,
  summary: portfolioSummarySchema,
  projects: z.array(activeProjectItemSchema)
});

export type ActiveProjectsResponse = z.infer<typeof activeProjectsResponseSchema>;

// Query parameters for the endpoint - exact specification from blueprint
export const activeProjectsQuerySchema = z.object({
  timeFilter: timeFilterSchema.optional().default('this_month'),
  onlyActiveInPeriod: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'string') {
      return val === 'true' || val === '1';
    }
    return Boolean(val);
  }).optional().default(false),
  basis: z.enum(['ECON', 'EXEC']).optional().default('ECON')
});

export type ActiveProjectsQuery = z.infer<typeof activeProjectsQuerySchema>;

// ==================== ETL NORMALIZED TABLES ====================

// Tabla SoT de ingresos (Income Source of Truth) - leer de "Proyectos confirmados y estimados"
export const incomeSot = pgTable("income_sot", {
  id: serial("id").primaryKey(),
  monthKey: varchar("month_key", { length: 7 }).notNull(), // YYYY-MM (Mes Facturación + Año Facturación)
  year: integer("year").notNull(), // Año Facturación
  clientName: text("client_name").notNull(), // Cliente
  projectName: text("project_name").notNull(), // Detalle
  projectType: text("project_type"), // Tipo de proyecto: 'Fee' | 'One Shot'
  confirmed: boolean("confirmed").notNull().default(true), // Confirmado = Sí
  statusHint: text("status_hint"), // Facturado/No requiere factura/etc (opcional)
  fxRef: numeric("fx_ref", { precision: 12, scale: 6 }), // Cotización (guardado para auditoría)
  amountLocalArs: numeric("amount_local_ars", { precision: 16, scale: 2 }), // Moneda Original ARS
  amountLocalUsd: numeric("amount_local_usd", { precision: 16, scale: 2 }), // Moneda Original USD
  revenueUsd: numeric("revenue_usd", { precision: 16, scale: 2 }).notNull(), // Monto Total USD (sin IVA) - CANÓNICO
  revenueUsdWithVat: numeric("revenue_usd_with_vat", { precision: 16, scale: 2 }), // Monto Total USD CON IVA (auditoría)
  revenueArsWithVat: numeric("revenue_ars_with_vat", { precision: 16, scale: 2 }), // Monto Total ARS CON IVA (auditoría)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueClientProjectMonth: unique().on(table.clientName, table.projectName, table.monthKey)
}));

// Tabla SoT de costos (Costs Source of Truth)
export const costsSot = pgTable("costs_sot", {
  id: serial("id").primaryKey(),
  projectKey: varchar("project_key", { length: 100 }).notNull(),
  monthKey: varchar("month_key", { length: 7 }).notNull(), // YYYY-MM format
  currencyNative: varchar("currency_native", { length: 3 }).notNull().default('ARS'), // ARS or USD
  costDisplay: numeric("cost_display", { precision: 12, scale: 2 }).notNull(), // en moneda nativa
  costUsd: numeric("cost_usd", { precision: 12, scale: 2 }).notNull(), // normalizado en USD
  flags: json("flags").$type<string[]>().default([]), // ['ANTI_X100_HOURS', 'USD_CORRUPTED_IGNORED', etc.]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectMonthIdx: unique().on(table.projectKey, table.monthKey)
}));

// Tabla SoT financiera unificada (Financial Source of Truth) - leer de "Rendimiento Cliente"
export const financialSot = pgTable("financial_sot", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(), // Cliente
  projectName: text("project_name").notNull(), // Proyecto
  projectType: text("project_type"), // Tipo de proyecto: 'Fee' | 'One Shot'
  monthKey: varchar("month_key", { length: 7 }).notNull(), // YYYY-MM (Mes + Año)
  year: integer("year").notNull(), // Año
  revenueUsd: numeric("revenue_usd", { precision: 16, scale: 2 }), // Facturación (USD) - columna G
  revenueArs: numeric("revenue_ars", { precision: 16, scale: 2 }), // Facturación [ARS] - columna I
  costUsd: numeric("cost_usd", { precision: 16, scale: 2 }), // Costos (USD) - columna H
  costArs: numeric("cost_ars", { precision: 16, scale: 2 }), // Costos [ARS] - columna K
  quotation: numeric("quotation", { precision: 16, scale: 2 }), // Cotización - columna F (para % presupuesto)
  fx: numeric("fx", { precision: 12, scale: 6 }).notNull(), // FX del mes para conversión a ARS
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueClientProjectMonth: unique().on(table.clientName, table.projectName, table.monthKey)
}));

// Tabla normalizada de ventas
export const salesNorm = pgTable("sales_norm", {
  id: serial("id").primaryKey(),
  projectKey: varchar("project_key", { length: 100 }).notNull(),
  monthKey: varchar("month_key", { length: 7 }).notNull(), // YYYY-MM format
  usd: numeric("usd", { precision: 12, scale: 2 }).notNull(),
  sourceRowId: varchar("source_row_id", { length: 255 }).notNull(),
  anomaly: varchar("anomaly", { length: 50 }), // 'x100_fixed', 'x10000_fixed', etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint to make it idempotent
  uniqueSource: unique().on(table.sourceRowId),
  // Index for fast queries
  projectMonthIdx: unique().on(table.projectKey, table.monthKey, table.sourceRowId)
}));

// Tabla normalizada de costos
export const costsNorm = pgTable("costs_norm", {
  id: serial("id").primaryKey(),
  projectKey: varchar("project_key", { length: 100 }).notNull(),
  monthKey: varchar("month_key", { length: 7 }).notNull(), // YYYY-MM format
  usd: numeric("usd", { precision: 12, scale: 2 }).notNull(),
  hoursWorked: numeric("hours_worked", { precision: 8, scale: 2 }),
  sourceRowId: varchar("source_row_id", { length: 255 }).notNull(),
  anomaly: varchar("anomaly", { length: 50 }), // 'x100_fixed', 'x10000_fixed', etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint to make it idempotent
  uniqueSource: unique().on(table.sourceRowId),
  // Index for fast queries
  projectMonthIdx: unique().on(table.projectKey, table.monthKey, table.sourceRowId)
}));

// Tabla normalizada de objetivos (targets)
export const targetsNorm = pgTable("targets_norm", {
  id: serial("id").primaryKey(),
  projectKey: varchar("project_key", { length: 100 }).notNull(),
  monthKey: varchar("month_key", { length: 7 }).notNull(), // YYYY-MM format
  targetHours: numeric("target_hours", { precision: 8, scale: 2 }).notNull(),
  rateUSD: numeric("rate_usd", { precision: 10, scale: 2 }), // optional
  sourceRowId: varchar("source_row_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint to make it idempotent
  uniqueSource: unique().on(table.sourceRowId),
  // Index for fast queries
  projectMonthIdx: unique().on(table.projectKey, table.monthKey, table.sourceRowId)
}));

// Insert schemas
export const insertIncomeSotSchema = createInsertSchema(incomeSot).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCostsSotSchema = createInsertSchema(costsSot).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFinancialSotSchema = createInsertSchema(financialSot).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesNormSchema = createInsertSchema(salesNorm).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCostsNormSchema = createInsertSchema(costsNorm).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTargetsNormSchema = createInsertSchema(targetsNorm).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type IncomeSot = typeof incomeSot.$inferSelect;
export type InsertIncomeSot = z.infer<typeof insertIncomeSotSchema>;
export type CostsSot = typeof costsSot.$inferSelect;
export type InsertCostsSot = z.infer<typeof insertCostsSotSchema>;
export type FinancialSot = typeof financialSot.$inferSelect;
export type InsertFinancialSot = z.infer<typeof insertFinancialSotSchema>;
export type SalesNorm = typeof salesNorm.$inferSelect;
export type InsertSalesNorm = z.infer<typeof insertSalesNormSchema>;
export type CostsNorm = typeof costsNorm.$inferSelect;
export type InsertCostsNorm = z.infer<typeof insertCostsNormSchema>;
export type TargetsNorm = typeof targetsNorm.$inferSelect;
export type InsertTargetsNorm = z.infer<typeof insertTargetsNormSchema>;

// ==================== SISTEMA DE 3 VISTAS (MULTIMONEDA) ====================
// Enum para tipos de vista (debe ir antes de las tablas)
export const viewTypeEnum = pgEnum('view_type', ['original', 'operativa', 'usd']);

// Tabla de períodos de proyecto (base para agregaciones)
export const projectPeriods = pgTable("project_periods", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id),
  periodKey: varchar("period_key", { length: 7 }).notNull(), // YYYY-MM
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  fx: numeric("fx", { precision: 10, scale: 4 }).notNull(), // Tipo de cambio del período
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueProjectPeriod: unique().on(table.projectId, table.periodKey)
}));

// Tabla de agregaciones por vista
export const projectAggregates = pgTable("project_aggregates", {
  id: serial("id").primaryKey(),
  projectPeriodId: integer("project_period_id").notNull().references(() => projectPeriods.id, { onDelete: 'cascade' }),
  viewType: viewTypeEnum("view_type").notNull(), // 'original' | 'operativa' | 'usd'
  currencyNative: varchar("currency_native", { length: 3 }).notNull(), // ARS | USD
  // Datos base (JSONB para flexibilidad)
  baseData: jsonb("base_data").notNull(), // { fact_ars, fact_usd, cost_ars, cost_usd, cotizacion_nat, cotizacion_usd }
  // Datos de la vista calculados
  viewData: jsonb("view_data").notNull(), // { revenue, cost, currency, cotizacion, markup, margin, budgetUtilization }
  // Datos de cotización
  quotationData: jsonb("quotation_data"), // { totalAmountNative, totalAmountUSD, estimatedHours }
  // Datos de actuals
  actualsData: jsonb("actuals_data"), // { totalWorkedHours, totalWorkedCost, teamBreakdown }
  // Flags de validación
  flags: text("flags").array().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueProjectPeriodView: unique().on(table.projectPeriodId, table.viewType)
}));

// Tabla de desglose de equipo por período
export const teamBreakdown = pgTable("team_breakdown", {
  id: serial("id").primaryKey(),
  projectPeriodId: integer("project_period_id").notNull().references(() => projectPeriods.id, { onDelete: 'cascade' }),
  personName: varchar("person_name", { length: 255 }).notNull(),
  roleName: varchar("role_name", { length: 255 }).notNull(),
  targetHours: numeric("target_hours", { precision: 8, scale: 2 }), // Horas objetivo (J)
  hoursReal: numeric("hours_real", { precision: 8, scale: 2 }), // Horas reales trabajadas
  hourlyRateARS: numeric("hourly_rate_ars", { precision: 10, scale: 2 }), // Valor hora ARS (N)
  costARS: numeric("cost_ars", { precision: 12, scale: 2 }), // Costo ARS (O)
  costUSD: numeric("cost_usd", { precision: 12, scale: 2 }), // Costo USD (R)
  isFromExcel: boolean("is_from_excel").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniquePersonPeriod: unique().on(table.projectPeriodId, table.personName, table.roleName)
}));

// Insert schemas
export const insertProjectPeriodSchema = createInsertSchema(projectPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectAggregateSchema = createInsertSchema(projectAggregates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamBreakdownSchema = createInsertSchema(teamBreakdown).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type ProjectPeriod = typeof projectPeriods.$inferSelect;
export type InsertProjectPeriod = z.infer<typeof insertProjectPeriodSchema>;
export type ProjectAggregate = typeof projectAggregates.$inferSelect;
export type InsertProjectAggregate = z.infer<typeof insertProjectAggregateSchema>;
export type TeamBreakdown = typeof teamBreakdown.$inferSelect;
export type InsertTeamBreakdown = z.infer<typeof insertTeamBreakdownSchema>;
export type ViewType = 'original' | 'operativa' | 'usd';

// ==================== TEAM BREAKDOWN JSON CONTRACTS ====================
// Contrato para teamBreakdown dentro de actualsData (JSONB)
// Este es el formato que el ETL genera y el frontend consume

export interface TeamBreakdownMember {
  personnelId: string;        // ID o nombre de la persona
  name: string;               // Nombre completo
  roleName: string;           // Rol en el proyecto
  
  // 3 tipos de horas (arquitectura de separación)
  targetHours: number;        // Horas objetivo/asignadas (capacidad)
  hoursAsana: number;         // Horas reales de Asana (operación)
  hoursBilling: number;       // Horas para facturación (rentabilidad)
  hours?: number;             // Legacy: mantener por compatibilidad (= hoursAsana)
  
  // Costos y rates
  hourlyRateARS: number;      // Valor hora en ARS
  costARS: number;            // Costo total ARS (hoursBilling × rate generalmente)
  costUSD: number;            // Costo total USD
  
  // Metadata
  flags?: string[];           // Ej: ['billing_from_asana', 'billing_from_target']
  isFromExcel?: boolean;      // Si viene del Excel MAESTRO
  usedTargetHoursFallback?: boolean; // Legacy flag
}

export interface ActualsData {
  // Agregados globales
  totalWorkedHours?: number;       // Legacy: usa hoursAsana
  totalAsanaHours?: number;        // Suma de hoursAsana
  totalBillingHours?: number;      // Suma de hoursBilling
  totalWorkedCostARS?: number;     // Suma de costARS
  totalWorkedCostUSD?: number;     // Suma de costUSD
  totalWorkedCost?: number;        // Legacy: mantener (= totalWorkedCostUSD)
  
  // Desglose por miembro
  teamBreakdown?: TeamBreakdownMember[];
}

export interface QuotationData {
  totalAmountNative?: number | null;
  totalAmountUSD?: number | null;
  estimatedHours?: number;  // Suma de targetHours
}

// ==================== SINGLE SOURCE OF TRUTH (SoT) - STAR SCHEMA ====================

// Dimensión: Períodos
export const dimPeriod = pgTable("dim_period", {
  periodKey: varchar("period_key", { length: 7 }).primaryKey(), // 'YYYY-MM'
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  firstDay: timestamp("first_day").notNull(),
  businessDays: integer("business_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDimPeriodSchema = createInsertSchema(dimPeriod).omit({ createdAt: true });
export type DimPeriod = typeof dimPeriod.$inferSelect;
export type InsertDimPeriod = z.infer<typeof insertDimPeriodSchema>;

// Dimensión: Tarifas por persona/período (catálogo de fallback)
export const dimPersonRate = pgTable("dim_person_rate", {
  id: serial("id").primaryKey(),
  personId: integer("person_id").references(() => personnel.id),
  projectId: integer("project_id").references(() => activeProjects.id), // null = tarifa general
  periodKey: varchar("period_key", { length: 7 }).notNull().references(() => dimPeriod.periodKey),
  hourlyRateARS: numeric("hourly_rate_ars", { precision: 10, scale: 2 }).notNull(),
  source: varchar("source", { length: 50 }), // 'manual', 'historical', 'role', 'excel'
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniquePersonProjectPeriod: unique().on(table.personId, table.projectId, table.periodKey)
}));

export const insertDimPersonRateSchema = createInsertSchema(dimPersonRate).omit({ 
  id: true, 
  updatedAt: true 
});
export type DimPersonRate = typeof dimPersonRate.$inferSelect;
export type InsertDimPersonRate = z.infer<typeof insertDimPersonRateSchema>;

// Hechos: Rendimiento Cliente (RC) por proyecto/mes
export const factRCMonth = pgTable("fact_rc_month", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id, { onDelete: 'cascade' }),
  periodKey: varchar("period_key", { length: 7 }).notNull().references(() => dimPeriod.periodKey),
  
  // Ingresos/costos en USD
  revenueUSD: numeric("revenue_usd", { precision: 12, scale: 2 }),
  costUSD: numeric("cost_usd", { precision: 12, scale: 2 }),
  
  // Ingresos/costos en ARS
  revenueARS: numeric("revenue_ars", { precision: 14, scale: 2 }),
  costARS: numeric("cost_ars", { precision: 14, scale: 2 }),
  
  // Precio/Cotización del proyecto para el mes (denominador presupuesto)
  quoteNative: numeric("quote_native", { precision: 12, scale: 2 }),
  
  // Tipo de cambio del período (para conversiones ARS/USD)
  fxRate: numeric("fx_rate", { precision: 10, scale: 4 }),
  
  // DEPRECATED: Mantener por compatibilidad, usar quoteNative y fxRate
  priceNative: numeric("price_native", { precision: 12, scale: 2 }),
  fx: numeric("fx", { precision: 10, scale: 4 }),
  
  // Metadata
  sourceRowId: text("source_row_id"),
  loadedAt: timestamp("loaded_at").notNull().defaultNow(),
}, (table) => ({
  uniqueProjectPeriod: unique().on(table.projectId, table.periodKey)
}));

export const insertFactRCMonthSchema = createInsertSchema(factRCMonth).omit({ 
  id: true, 
  loadedAt: true 
});
export type FactRCMonth = typeof factRCMonth.$inferSelect;
export type InsertFactRCMonth = z.infer<typeof insertFactRCMonthSchema>;

// Hechos: Labor/Costos directos por proyecto/persona/mes
export const factLaborMonth = pgTable("fact_labor_month", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id, { onDelete: 'cascade' }),
  personId: integer("person_id").references(() => personnel.id),
  periodKey: varchar("period_key", { length: 7 }).notNull().references(() => dimPeriod.periodKey),
  
  // Claves normalizadas para matching
  clientKey: varchar("client_key", { length: 255 }),
  projectKey: varchar("project_key", { length: 255 }),
  personKey: varchar("person_key", { length: 255 }),
  
  // 3 tipos de horas
  targetHours: numeric("target_hours", { precision: 10, scale: 2 }).default('0'),
  asanaHours: numeric("asana_hours", { precision: 10, scale: 2 }).default('0'),
  billingHours: numeric("billing_hours", { precision: 10, scale: 2 }).default('0'),
  
  // Valores y costos
  hourlyRateARS: numeric("hourly_rate_ars", { precision: 10, scale: 2 }),
  costARS: numeric("cost_ars", { precision: 12, scale: 2 }),
  costUSD: numeric("cost_usd", { precision: 12, scale: 2 }),
  fx: numeric("fx", { precision: 10, scale: 4 }),
  
  // Rol
  roleName: varchar("role_name", { length: 100 }),
  
  // Flags y metadata
  flags: jsonb("flags").default([]),
  sourceRowId: text("source_row_id"),
  loadedAt: timestamp("loaded_at").notNull().defaultNow(),
}, (table) => ({
  uniqueProjectPersonPeriod: unique().on(table.projectId, table.personKey, table.periodKey)
}));

export const insertFactLaborMonthSchema = createInsertSchema(factLaborMonth).omit({ 
  id: true, 
  loadedAt: true 
});
export type FactLaborMonth = typeof factLaborMonth.$inferSelect;
export type InsertFactLaborMonth = z.infer<typeof insertFactLaborMonthSchema>;

// Hechos: Costos totales por período (suma directa Col R del Excel, separado por tipo)
export const factCostMonth = pgTable("fact_cost_month", {
  id: serial("id").primaryKey(),
  periodKey: varchar("period_key", { length: 7 }).notNull().references(() => dimPeriod.periodKey),
  
  // Costos DIRECTOS (Tipo de Costo = "Directo" o "Costos directos e indirectos")
  directUSD: numeric("direct_usd", { precision: 14, scale: 2 }).notNull().default('0'),
  directARS: numeric("direct_ars", { precision: 14, scale: 2 }).notNull().default('0'),
  
  // Costos INDIRECTOS OPERATIVOS (overhead real del mes, SIN provisiones)
  // Incluye: sueldos administrativos, servicios, software, alquiler, honorarios
  // Excluye: Provisiones, IVA, Impuestos USA, Ajustes contables
  indirectUSD: numeric("indirect_usd", { precision: 14, scale: 2 }).notNull().default('0'),
  indirectARS: numeric("indirect_ars", { precision: 14, scale: 2 }).notNull().default('0'),
  
  // PROVISIONES CONTABLES (solo para vista Financiero)
  // Incluye: Provisión Pepsico, Warner, Impuestos USA, IVA, Pasivos, Ajustes
  provisionsUSD: numeric("provisions_usd", { precision: 14, scale: 2 }).notNull().default('0'),
  provisionsARS: numeric("provisions_ars", { precision: 14, scale: 2 }).notNull().default('0'),
  
  // Montos totales (deprecated - usar directUSD + indirectUSD + provisionsUSD para contable)
  amountUSD: numeric("amount_usd", { precision: 14, scale: 2 }).notNull().default('0'),
  amountARS: numeric("amount_ars", { precision: 14, scale: 2 }).default('0'),
  
  // Auditoría
  sourceRowsCount: integer("source_rows_count").default(0),
  directRowsCount: integer("direct_rows_count").default(0),
  indirectRowsCount: integer("indirect_rows_count").default(0),
  provisionsRowsCount: integer("provisions_rows_count").default(0),
  etlTimestamp: timestamp("etl_timestamp").notNull().defaultNow(),
}, (table) => ({
  uniquePeriod: unique().on(table.periodKey)
}));

export const insertFactCostMonthSchema = createInsertSchema(factCostMonth).omit({ 
  id: true, 
  etlTimestamp: true 
});
export type FactCostMonth = typeof factCostMonth.$inferSelect;
export type InsertFactCostMonth = z.infer<typeof insertFactCostMonthSchema>;

// Agregado: Proyecto/Mes precalculado (SSOT para dashboards)
export const aggProjectMonth = pgTable("agg_project_month", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id, { onDelete: 'cascade' }),
  periodKey: varchar("period_key", { length: 7 }).notNull().references(() => dimPeriod.periodKey),
  
  // Horas agregadas
  estHours: numeric("est_hours", { precision: 10, scale: 2 }),
  totalAsanaHours: numeric("total_asana_hours", { precision: 10, scale: 2 }),
  totalBillingHours: numeric("total_billing_hours", { precision: 10, scale: 2 }),
  
  // Costos agregados
  totalCostARS: numeric("total_cost_ars", { precision: 14, scale: 2 }),
  totalCostUSD: numeric("total_cost_usd", { precision: 12, scale: 2 }),
  
  // Vista Operativa (precalculada según moneda nativa)
  viewOperativaRevenue: numeric("view_operativa_revenue", { precision: 12, scale: 2 }),
  viewOperativaCost: numeric("view_operativa_cost", { precision: 12, scale: 2 }),
  viewOperativaDenom: numeric("view_operativa_denom", { precision: 12, scale: 2 }), // Presupuesto/precio
  viewOperativaMarkup: numeric("view_operativa_markup", { precision: 10, scale: 4 }),
  viewOperativaMargin: numeric("view_operativa_margin", { precision: 10, scale: 4 }),
  viewOperativaBudgetUtil: numeric("view_operativa_budget_util", { precision: 10, scale: 4 }),
  
  // Datos de RC (auditoría)
  rcRevenueNative: numeric("rc_revenue_native", { precision: 12, scale: 2 }),
  rcCostNative: numeric("rc_cost_native", { precision: 12, scale: 2 }),
  rcPriceNative: numeric("rc_price_native", { precision: 12, scale: 2 }),
  fx: numeric("fx", { precision: 10, scale: 4 }),
  
  // Flags y metadata
  flags: jsonb("flags").default([]),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
}, (table) => ({
  uniqueProjectPeriod: unique().on(table.projectId, table.periodKey)
}));

export const insertAggProjectMonthSchema = createInsertSchema(aggProjectMonth).omit({ 
  id: true, 
  computedAt: true 
});
export type AggProjectMonth = typeof aggProjectMonth.$inferSelect;
export type InsertAggProjectMonth = z.infer<typeof insertAggProjectMonthSchema>;

// ==================== RESUMEN FINANCIERO MENSUAL ====================
// Tabla para almacenar KPIs financieros mensuales desde hoja "Resumen Ejecutivo" del Excel MAESTRO
// Single Source of Truth para visión CFO/Administración
export const monthlyFinancialSummary = pgTable("monthly_financial_summary", {
  id: serial("id").primaryKey(),
  
  // Período
  periodKey: varchar("period_key", { length: 7 }).notNull().unique(), // YYYY-MM
  year: integer("year").notNull(),
  monthNumber: integer("month_number").notNull(), // 1-12
  monthLabel: varchar("month_label", { length: 20 }), // "10 oct" como viene en el Excel
  cierreDate: timestamp("cierre_date"), // Fecha de cierre si está disponible
  
  // Balance y Activos/Pasivos
  totalActivo: numeric("total_activo", { precision: 14, scale: 2 }),
  totalPasivo: numeric("total_pasivo", { precision: 14, scale: 2 }),
  balanceNeto: numeric("balance_neto", { precision: 14, scale: 2 }), // Activo - Pasivo
  cajaTotal: numeric("caja_total", { precision: 14, scale: 2 }),
  inversiones: numeric("inversiones", { precision: 14, scale: 2 }), // Inversiones / Crypto
  
  // Cashflow
  cashflowIngresos: numeric("cashflow_ingresos", { precision: 14, scale: 2 }),
  cashflowEgresos: numeric("cashflow_egresos", { precision: 14, scale: 2 }),
  cashflowNeto: numeric("cashflow_neto", { precision: 14, scale: 2 }), // Cash Flow neto del mes
  
  // Cuentas por cobrar/pagar
  cuentasCobrarUsd: numeric("cuentas_cobrar_usd", { precision: 12, scale: 2 }),
  cuentasPagarUsd: numeric("cuentas_pagar_usd", { precision: 12, scale: 2 }),
  
  // Facturación y costos (visión contable)
  facturacionTotal: numeric("facturacion_total", { precision: 14, scale: 2 }), // Ventas facturadas del mes
  costosDirectos: numeric("costos_directos", { precision: 14, scale: 2 }), // Costos directos contables
  costosIndirectos: numeric("costos_indirectos", { precision: 14, scale: 2 }), // Costos indirectos contables
  ivaCompras: numeric("iva_compras", { precision: 12, scale: 2 }),
  impuestosUsa: numeric("impuestos_usa", { precision: 12, scale: 2 }),
  
  // Provisiones (para cálculo de Devengado)
  pasivoFacturacionAdelantada: numeric("pasivo_facturacion_adelantada", { precision: 14, scale: 2 }), // Provisión Facturación Adelantada
  
  // Resultados
  ebitOperativo: numeric("ebit_operativo", { precision: 14, scale: 2 }), // EBIT (Utilidad operativa)
  beneficioNeto: numeric("beneficio_neto", { precision: 14, scale: 2 }), // Beneficio neto (con provisiones)
  markupPromedio: numeric("markup_promedio", { precision: 10, scale: 4 }), // Markup promedio global
  margenOperativo: numeric("margen_operativo", { precision: 8, scale: 4 }), // Margen Operativo % (from sheet)
  margenNeto: numeric("margen_neto", { precision: 8, scale: 4 }), // Margen Neto % (from sheet)

  // Proyección y Balance 60 días
  proyeccionResultado: numeric("proyeccion_resultado", { precision: 14, scale: 2 }), // Proyección resultado
  balance60Dias: numeric("balance_60_dias", { precision: 14, scale: 2 }), // Balance 60 días
  
  // Metadatos
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  periodIdx: index("mfs_period_idx").on(table.periodKey),
  yearMonthIdx: index("mfs_year_month_idx").on(table.year, table.monthNumber),
}));

export const insertMonthlyFinancialSummarySchema = createInsertSchema(monthlyFinancialSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MonthlyFinancialSummary = typeof monthlyFinancialSummary.$inferSelect;
export type InsertMonthlyFinancialSummary = z.infer<typeof insertMonthlyFinancialSummarySchema>;

// ==================== COSTOS RECHAZADOS (AUDITORÍA) ====================
// Tabla para almacenar costos que fueron rechazados durante el ETL
// Permite auditabilidad y reporte de calidad de datos
export const costosRechazados = pgTable("costos_rechazados", {
  id: serial("id").primaryKey(),
  
  // Metadata de rechazo
  rejectedAt: timestamp("rejected_at").notNull().defaultNow(),
  rejectReason: varchar("reject_reason", { length: 100 }).notNull(), // no_tipo_no_subtipo, bad_periodKey, etc
  
  // Campos extraídos (pueden ser inválidos)
  periodKey: varchar("period_key", { length: 20 }), // Puede ser inválido
  clientName: varchar("client_name", { length: 255 }),
  projectName: varchar("project_name", { length: 255 }),
  
  // Clasificación (usualmente vacía si fue rechazado)
  tipoCosto: varchar("tipo_costo", { length: 100 }),
  subtipoCosto: varchar("subtipo_costo", { length: 100 }),
  
  // Montos (si estaban presentes)
  amountARS: numeric("amount_ars", { precision: 14, scale: 2 }),
  amountUSD: numeric("amount_usd", { precision: 12, scale: 2 }),
  
  // Campos raw para debugging
  monthRaw: varchar("month_raw", { length: 50 }),
  yearRaw: varchar("year_raw", { length: 50 }),
  
  // Datos completos originales
  rawData: jsonb("raw_data").notNull(),
  
  // Índices para queries comunes
}, (table) => ({
  reasonIdx: index("reject_reason_idx").on(table.rejectReason),
  periodIdx: index("reject_period_idx").on(table.periodKey),
  rejectedAtIdx: index("rejected_at_idx").on(table.rejectedAt),
}));

export const insertCostosRechazadosSchema = createInsertSchema(costosRechazados).omit({
  id: true,
  rejectedAt: true,
});
export type CostosRechazados = typeof costosRechazados.$inferSelect;
export type InsertCostosRechazados = z.infer<typeof insertCostosRechazadosSchema>;

// ==================== PROJECT DETAILS VIEW MODEL ====================
// Tipo dedicado para el payload completo de /api/projects/:id/complete-data
// Refleja la estructura real que el backend genera para project-details-redesigned.tsx

export interface ProjectDetailsVM {
  view: ViewType;
  project: {
    id: number;
    name: string;
    status: string;
    startDate: string;
    expectedEndDate: string;
    clientId: number;
    quotationId: number;
    revenueDisplay?: number;
    costDisplay?: number;
    cotizacion?: number;
    currencyNative: 'USD' | 'ARS';
    budgetUtilization?: number;
    // One-shot project flags
    isOneShot?: boolean;
    hasRevenueInPeriod?: boolean;
    periodWithRevenue?: string | null;
  };
  quotation: {
    id: number;
    projectName: string;
    baseCost: number;
    totalAmount: number;
    totalAmountNative: number;
    estimatedHours: number;
    markupAmount: number;
    marginFactor: number;
  } | null;
  actuals: ActualsData;
  metrics: {
    efficiency: number;
    markup: number;
    margin: number;
    budgetUtilization: number;
    hoursDeviation: number;
    costDeviation: number;
  };
  summary: {
    costDisplay: number;
    currencyNative: 'USD' | 'ARS';
    revenueDisplay?: number;
    teamCostUSD?: number;
    revenueUSD?: number;
    efficiencyPct?: number;
    totalHours?: number;
    flags?: string[];
  };
  teamBreakdown: TeamBreakdownMember[];
  ingresos: any[];
  costos: any[];
  estimatedHours?: number;
  workedHours?: number;
  totalCost?: number;
  totalRealRevenue?: number;
  // Period comparison data
  previousPeriod?: {
    period: string;
    hasData: boolean;
    metrics: {
      revenueUSD: number;
      teamCostUSD: number;
      totalHours: number;
      efficiencyPct: number;
      teamMembers: number;
      markup: number;
      margin: number;
    } | null;
  } | null;
  // Advanced analytics objects (optional, may be added by frontend)
  analytics?: {
    rows?: any[];
    kpis?: any;
    workload?: any;
    bottlenecks?: any;
    riskBreakdown?: any;
    recommendations?: any;
  };
}

// ==================== CRM VENTAS ====================

export const crmLeads = pgTable("crm_leads", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  stage: varchar("stage", { length: 50 }).notNull().default('new'), // new|contacted|qualified|proposal|negotiation|won|lost
  source: varchar("source", { length: 100 }), // referido|linkedin|web|evento|otro
  estimatedValueUsd: doublePrecision("estimated_value_usd"),
  notes: text("notes"),
  clientId: integer("client_id").references(() => clients.id), // vínculo a cliente existente
  assignedTo: integer("assigned_to").references(() => users.id),
  lostReason: text("lost_reason"),
  wonAt: timestamp("won_at"),
  lostAt: timestamp("lost_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
});

export const crmContacts = pgTable("crm_contacts", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => crmLeads.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  position: varchar("position", { length: 150 }),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const crmActivities = pgTable("crm_activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => crmLeads.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(), // note|call|email|meeting|proposal|followup
  title: varchar("title", { length: 255 }),
  content: text("content"),
  activityDate: timestamp("activity_date").notNull().defaultNow(),
  quotationId: integer("quotation_id").references(() => quotations.id),
  emailMetadata: json("email_metadata"), // { subject, to, body, sentAt }
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const crmReminders = pgTable("crm_reminders", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => crmLeads.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  notifiedAt: timestamp("notified_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const crmStages = pgTable("crm_stages", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  color: varchar("color", { length: 50 }).notNull().default('slate'),
  position: integer("position").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  followUpDays: integer("follow_up_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrmStageSchema = createInsertSchema(crmStages).omit({
  id: true,
  createdAt: true,
});

export type CrmStage = typeof crmStages.$inferSelect;
export type InsertCrmStage = z.infer<typeof insertCrmStageSchema>;

// Insert Schemas — CRM
export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  wonAt: true,
  lostAt: true,
});

export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({
  id: true,
  createdAt: true,
});

export const insertCrmActivitySchema = createInsertSchema(crmActivities).omit({
  id: true,
  createdAt: true,
});

export const insertCrmReminderSchema = createInsertSchema(crmReminders).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  notifiedAt: true,
});

// Types — CRM
export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;
export type CrmReminder = typeof crmReminders.$inferSelect;
export type InsertCrmReminder = z.infer<typeof insertCrmReminderSchema>;

// ─── Status Semanal / Review Rooms ────────────────────────────────────────────

// Note: reviewRooms is declared after the status tables below but referenced here
// via a forward `sql` reference in the SQL migration. Drizzle handles the FK
// at the DB level, so the TS column declaration here only needs `integer`.
export const projectStatusReviews = pgTable("project_status_reviews", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  projectId: integer("project_id").notNull().references(() => activeProjects.id, { onDelete: 'cascade' }),
  healthStatus: varchar("health_status", { length: 20 }).default('verde'), // verde | amarillo | rojo
  marginStatus: varchar("margin_status", { length: 20 }).default('medio'), // alto | medio | bajo
  teamStrain: varchar("team_strain", { length: 20 }).default('bajo'), // alto | medio | bajo
  mainRisk: text("main_risk"),
  currentAction: text("current_action"),
  nextMilestone: text("next_milestone"),
  nextMilestoneDate: timestamp("next_milestone_date"),
  deadline: timestamp("deadline"),
  ownerId: integer("owner_id").references(() => users.id),
  decisionNeeded: varchar("decision_needed", { length: 30 }).default('ninguna'), // ninguna | priorizacion | recursos | reprecio | salida
  hiddenFromWeekly: boolean("hidden_from_weekly").default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  uqRoomProject: unique("project_status_reviews_room_project_unique").on(t.roomId, t.projectId),
  idxRoom: index("idx_psr_room").on(t.roomId),
}));

export const insertProjectStatusReviewSchema = createInsertSchema(projectStatusReviews).omit({
  id: true,
  updatedAt: true,
  updatedBy: true,
}).extend({
  healthStatus: z.enum(['verde', 'amarillo', 'rojo']).default('verde'),
  marginStatus: z.enum(['alto', 'medio', 'bajo']).default('medio'),
  teamStrain: z.enum(['alto', 'medio', 'bajo']).default('bajo'),
  decisionNeeded: z.enum(['ninguna', 'priorizacion', 'recursos', 'reprecio', 'salida']).default('ninguna'),
  nextMilestoneDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
  deadline: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
});
export type ProjectStatusReview = typeof projectStatusReviews.$inferSelect;
export type InsertProjectStatusReview = z.infer<typeof insertProjectStatusReviewSchema>;

export const projectReviewNotes = pgTable("project_review_notes", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  projectId: integer("project_id").references(() => activeProjects.id, { onDelete: 'cascade' }),
  weeklyStatusItemId: integer("weekly_status_item_id").references(() => weeklyStatusItems.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  noteDate: timestamp("note_date").notNull().defaultNow(),
  authorId: integer("author_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxRoom: index("idx_prn_room").on(t.roomId),
}));

export const insertProjectReviewNoteSchema = createInsertSchema(projectReviewNotes).omit({
  id: true,
  createdAt: true,
});
export type ProjectReviewNote = typeof projectReviewNotes.$inferSelect;
export type InsertProjectReviewNote = z.infer<typeof insertProjectReviewNoteSchema>;

export const weeklyStatusItems = pgTable("weekly_status_items", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  healthStatus: varchar("health_status", { length: 20 }).default('verde'),
  marginStatus: varchar("margin_status", { length: 20 }).default('medio'),
  teamStrain: varchar("team_strain", { length: 20 }).default('bajo'),
  mainRisk: text("main_risk"),
  currentAction: text("current_action"),
  nextMilestone: text("next_milestone"),
  deadline: timestamp("deadline"),
  ownerId: integer("owner_id").references(() => users.id),
  decisionNeeded: varchar("decision_needed", { length: 30 }).default('ninguna'),
  hiddenFromWeekly: boolean("hidden_from_weekly").default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxRoom: index("idx_wsi_room").on(t.roomId),
}));

export const insertWeeklyStatusItemSchema = createInsertSchema(weeklyStatusItems).omit({
  id: true,
  updatedAt: true,
  updatedBy: true,
  createdAt: true,
}).extend({
  healthStatus: z.enum(['verde', 'amarillo', 'rojo']).default('verde'),
  marginStatus: z.enum(['alto', 'medio', 'bajo']).default('medio'),
  teamStrain: z.enum(['alto', 'medio', 'bajo']).default('bajo'),
  decisionNeeded: z.enum(['ninguna', 'priorizacion', 'recursos', 'reprecio', 'salida']).default('ninguna'),
  deadline: z.union([z.date(), z.string().transform((str) => new Date(str))]).nullable().optional(),
});
export type WeeklyStatusItem = typeof weeklyStatusItems.$inferSelect;
export type InsertWeeklyStatusItem = z.infer<typeof insertWeeklyStatusItemSchema>;

// ─── Status Update Entries (accumulating update history) ─────────────────────
export const statusUpdateEntries = pgTable("status_update_entries", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  projectId: integer("project_id").references(() => activeProjects.id, { onDelete: 'cascade' }),
  weeklyStatusItemId: integer("weekly_status_item_id").references(() => weeklyStatusItems.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  authorId: integer("author_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxRoom: index("idx_sue_room").on(t.roomId),
}));
export type StatusUpdateEntry = typeof statusUpdateEntries.$inferSelect;

// ─── Status Change Log (audit trail for status changes) ─────────────────────
export const statusChangeLog = pgTable("status_change_log", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  projectId: integer("project_id").references(() => activeProjects.id, { onDelete: 'cascade' }),
  weeklyStatusItemId: integer("weekly_status_item_id").references(() => weeklyStatusItems.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id),
  fieldName: varchar("field_name", { length: 30 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxRoom: index("idx_scl_room").on(t.roomId),
}));
export type StatusChangeLog = typeof statusChangeLog.$inferSelect;

// ─── Review Rooms ─────────────────────────────────────────────────────────────

export const reviewRooms = pgTable("review_rooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  colorIndex: integer("color_index").notNull().default(0),
  emoji: varchar("emoji", { length: 16 }),
  privacy: varchar("privacy", { length: 20 }).notNull().default('members'),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReviewRoomSchema = createInsertSchema(reviewRooms).omit({
  id: true,
  createdBy: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  colorIndex: z.number().int().min(0).max(20).default(0),
  emoji: z.string().trim().max(16).nullable().optional(),
});
export type ReviewRoom = typeof reviewRooms.$inferSelect;
export type InsertReviewRoom = z.infer<typeof insertReviewRoomSchema>;

export const reviewRoomMembers = pgTable("review_room_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => reviewRooms.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 20 }).notNull().default('editor'),
  addedBy: integer("added_by").references(() => users.id, { onDelete: 'set null' }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  lastVisitedAt: timestamp("last_visited_at"),
}, (t) => ({
  uqRoomUser: unique("review_room_members_room_user_unique").on(t.roomId, t.userId),
  idxUser: index("idx_rrm_user").on(t.userId),
  idxRoom: index("idx_rrm_room").on(t.roomId),
}));

export const insertReviewRoomMemberSchema = createInsertSchema(reviewRoomMembers).omit({
  id: true,
  addedBy: true,
  addedAt: true,
  lastVisitedAt: true,
}).extend({
  role: z.enum(['owner', 'editor']).default('editor'),
});
export type ReviewRoomMember = typeof reviewRoomMembers.$inferSelect;
export type InsertReviewRoomMember = z.infer<typeof insertReviewRoomMemberSchema>;