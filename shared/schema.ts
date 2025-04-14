import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json } from "drizzle-orm/pg-core";
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
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).pick({
  name: true,
  description: true,
  complexity: true,
  pageRange: true,
  features: true,
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
  projectType: text("project_type").notNull(), // 'executive', 'comprehensive', 'campaign', 'always-on'
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

// Analysis type options
export const analysisTypes = [
  { value: "basic", label: "Basic Analysis" },
  { value: "standard", label: "Standard Analysis" },
  { value: "deep", label: "Deep Analysis" },
];

// Project type options
export const projectTypes = [
  { value: "executive", label: "Executive Report" },
  { value: "comprehensive", label: "Comprehensive Report" },
  { value: "campaign", label: "Campaign Lifecycle Reports" },
  { value: "always-on", label: "Always-On Fee-Based Service" },
];

// Mentions volume options
export const mentionsVolumeOptions = [
  { value: "small", label: "1k - 10k mentions" },
  { value: "medium", label: "10k - 50k mentions" },
  { value: "large", label: "50k - 200k mentions" },
  { value: "xlarge", label: "200k+ mentions" },
];

// Countries covered options
export const countriesCoveredOptions = [
  { value: "1", label: "Single country" },
  { value: "2-5", label: "2-5 countries" },
  { value: "6-10", label: "6-10 countries" },
  { value: "10+", label: "10+ countries" },
];

// Client engagement level options
export const clientEngagementOptions = [
  { value: "low", label: "Low (Minimal revisions)" },
  { value: "medium", label: "Medium (2-3 revision cycles)" },
  { value: "high", label: "High (Multiple touchpoints)" },
];

// Quotation status options
export const quotationStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "in-negotiation", label: "In Negotiation" },
];
