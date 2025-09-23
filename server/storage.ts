import {
  type Client, type InsertClient,
  type Role, type InsertRole,
  type Personnel, type InsertPersonnel,
  type ReportTemplate, type InsertReportTemplate,
  type Quotation, type InsertQuotation,
  type QuotationTeamMember, type InsertQuotationTeamMember,
  type QuotationVariant, type InsertQuotationVariant,
  type TemplateRoleAssignment, type InsertTemplateRoleAssignment,
  type ActiveProject, type InsertActiveProject,
  type ProjectComponent, type InsertProjectComponent,
  type TimeEntry, type InsertTimeEntry,
  type ProgressReport, type InsertProgressReport,
  type User, type InsertUser,
  type Deliverable, type InsertDeliverable,
  type ClientModoComment, type InsertClientModoComment,
  type QuarterlyNpsSurvey, type InsertQuarterlyNpsSurvey,
  type CostMultiplier, type InsertCostMultiplier,
  type RecurringProjectTemplate, type InsertRecurringProjectTemplate,
  type RecurringTemplatePersonnel, type InsertRecurringTemplatePersonnel,
  type ProjectCycle, type InsertProjectCycle,
  type ProjectBaseTeam, type InsertProjectBaseTeam,
  type QuickTimeEntry, type InsertQuickTimeEntry,
  type QuickTimeEntryDetail, type InsertQuickTimeEntryDetail,
  type UnquotedPersonnel, type InsertUnquotedPersonnel,
  type MonthlyHourAdjustment, type InsertMonthlyHourAdjustment,
  type ProjectPriceAdjustment, type InsertProjectPriceAdjustment,
  type NegotiationHistory, type InsertNegotiationHistory,
  type ExchangeRate, type InsertExchangeRate,
  type ProjectMonthlyRevenue, type InsertProjectMonthlyRevenue,
  type ProjectPricingChange, type InsertProjectPricingChange,
  type ProjectFinancialSummary, type InsertProjectFinancialSummary,
  type ProjectMonthlySales, type InsertProjectMonthlySales,
  type ProjectFinancialTransaction, type InsertProjectFinancialTransaction,
  type GoogleSheetsSales, type InsertGoogleSheetsSales,
  type DirectCost, type InsertDirectCost,
  type IncomeRecord,
  insertDirectCostSchema,

  type IndirectCostCategory, type InsertIndirectCostCategory,
  type IndirectCost, type InsertIndirectCost,
  type NonBillableHours, type InsertNonBillableHours,
  type GoogleSheetsProject, type InsertGoogleSheetsProject,
  type GoogleSheetsProjectBilling, type InsertGoogleSheetsProjectBilling,
  clients, roles, personnel, reportTemplates, quotations, quotationTeamMembers, quotationVariants, templateRoleAssignments,
  activeProjects, projectComponents, timeEntries, progressReports, users, quarterlyNpsSurveys,
  analysisTypes, projectTypes, mentionsVolumeOptions, countriesCoveredOptions, clientEngagementOptions,
  projectStatusOptions, trackingFrequencyOptions,
  chatConversations, chatMessages, chatConversationParticipants,
  deliverables, clientModoComments, costMultipliers, recurringProjectTemplates, recurringTemplatePersonnel, projectCycles,
  projectBaseTeam, quickTimeEntries, quickTimeEntryDetails, passwordResetTokens, unquotedPersonnel, monthlyHourAdjustments,
  projectPriceAdjustments, negotiationHistory, exchangeRates, indirectCostCategories, indirectCosts, nonBillableHours,
  googleSheetsProjects, googleSheetsProjectBilling, projectMonthlyRevenue, projectPricingChanges, projectFinancialSummary,
  projectMonthlySales, projectFinancialTransactions, googleSheetsSales, directCosts
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, ne, and, sql, inArray, desc, asc } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { getDateRangeForFilter } from "./utils/dateRange";

// Función auxiliar para obtener el campo correcto de costo histórico
function getHistoricalMonthField(year: number, month: number, type: 'hourly' | 'salary'): string {
  const monthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  
  const monthName = monthNames[month];
  const suffix = type === 'hourly' ? 'HourlyRateARS' : 'MonthlySalaryARS';
  
  return `${monthName}${year}${suffix}`;
}

export interface IStorage {
  // Client operations
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByName(name: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;

  // Role operations
  getRoles(): Promise<Role[]>;
  getRole(id: number): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: number, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: number): Promise<boolean>;

  // Personnel operations
  getPersonnel(): Promise<Personnel[]>;
  getPersonnelByRole(roleId: number): Promise<Personnel[]>;
  getPersonnelById(id: number): Promise<Personnel | undefined>;
  createPersonnel(personnel: InsertPersonnel): Promise<Personnel>;
  updatePersonnel(id: number, personnel: Partial<InsertPersonnel>): Promise<Personnel | undefined>;
  deletePersonnel(id: number): Promise<boolean>;

  // Report template operations
  getReportTemplates(): Promise<ReportTemplate[]>;
  getReportTemplate(id: number): Promise<ReportTemplate | undefined>;
  createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate>;
  updateReportTemplate(id: number, template: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined>;
  deleteReportTemplate(id: number): Promise<boolean>;

  // Quotation operations
  getQuotations(): Promise<Quotation[]>;
  getQuotationsByClient(clientId: number): Promise<Quotation[]>;
  getQuotation(id: number): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  deleteQuotation(id: number): Promise<boolean>;

  // Negotiation history operations
  getNegotiationHistory(quotationId: number): Promise<NegotiationHistory[]>;
  createNegotiationHistory(history: InsertNegotiationHistory): Promise<NegotiationHistory>;
  getLatestNegotiation(quotationId: number): Promise<NegotiationHistory | undefined>;

  // Quotation team member operations
  getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]>;
  getQuotationTeamMembersByVariant(variantId: number): Promise<QuotationTeamMember[]>;
  createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember>;
  updateQuotationTeamMember(id: number, member: Partial<InsertQuotationTeamMember>): Promise<QuotationTeamMember | undefined>;
  deleteQuotationTeamMember(id: number): Promise<boolean>;
  deleteQuotationTeamMemberById(id: number): Promise<void>;

  // Quotation variant operations
  getQuotationVariants(quotationId: number): Promise<QuotationVariant[]>;
  getQuotationVariant(id: number): Promise<QuotationVariant | undefined>;
  createQuotationVariant(variant: InsertQuotationVariant): Promise<QuotationVariant>;
  updateQuotationVariant(id: number, variant: Partial<InsertQuotationVariant>): Promise<QuotationVariant | undefined>;
  deleteQuotationVariant(id: number): Promise<boolean>;

  // Template role assignment operations
  getTemplateRoleAssignments(templateId: number): Promise<TemplateRoleAssignment[]>;
  getTemplateRoleAssignmentsWithRoles(templateId: number): Promise<(TemplateRoleAssignment & { role: Role })[]>;
  createTemplateRoleAssignment(assignment: InsertTemplateRoleAssignment): Promise<TemplateRoleAssignment>;
  updateTemplateRoleAssignment(id: number, assignment: Partial<InsertTemplateRoleAssignment>): Promise<TemplateRoleAssignment | undefined>;
  deleteTemplateRoleAssignment(id: number): Promise<boolean>;
  deleteTemplateRoleAssignments(templateId: number): Promise<void>;

  // Option lists
  getAnalysisTypes(): Promise<typeof analysisTypes>;
  getProjectTypes(): Promise<typeof projectTypes>;
  getProjectDurationOptions(projectType: string): Promise<{value: string, label: string}[]>;
  getMentionsVolumeOptions(): Promise<typeof mentionsVolumeOptions>;
  getCountriesCoveredOptions(): Promise<typeof countriesCoveredOptions>;
  getClientEngagementOptions(): Promise<typeof clientEngagementOptions>;
  getProjectStatusOptions(): Promise<typeof projectStatusOptions>;
  getTrackingFrequencyOptions(): Promise<typeof trackingFrequencyOptions>;

  // Active project operations
  getActiveProjects(): Promise<(ActiveProject & { quotation: Quotation & { client?: Client } })[]>;
  getActiveProjectsByClient(clientId: number): Promise<(ActiveProject & { quotation: Quotation })[]>;
  getActiveProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]>;
  getActiveProject(id: number): Promise<(ActiveProject & { quotation: Quotation & { client?: Client } }) | undefined>;
  createActiveProject(project: InsertActiveProject): Promise<ActiveProject>;
  updateActiveProject(id: number, project: Partial<InsertActiveProject>): Promise<ActiveProject | undefined>;
  deleteActiveProject(id: number): Promise<boolean>;

  // Project component operations
  getProjectComponents(projectId: number): Promise<ProjectComponent[]>;
  createProjectComponent(component: InsertProjectComponent): Promise<ProjectComponent>;
  updateProjectComponent(id: number, component: Partial<InsertProjectComponent>): Promise<ProjectComponent | undefined>;
  deleteProjectComponent(id: number): Promise<boolean>;

  // Time entry operations
  getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]>;
  getTimeEntriesByPersonnel(personnelId: number): Promise<TimeEntry[]>;
  getTimeEntries(): Promise<TimeEntry[]>;
  getTimeEntriesByClient(clientId: number): Promise<TimeEntry[]>;
  getTimeEntryById(id: number): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<boolean>;
  deleteTimeEntriesByProject(projectId: number): Promise<void>;
  approveTimeEntry(id: number, approverId: number): Promise<TimeEntry | undefined>;

  // Progress report operations
  getProgressReports(projectId: number): Promise<ProgressReport[]>;
  createProgressReport(report: InsertProgressReport): Promise<ProgressReport>;
  updateProgressReport(id: number, report: Partial<InsertProgressReport>): Promise<ProgressReport | undefined>;
  deleteProgressReport(id: number): Promise<boolean>;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;

  // Password reset operations
  createPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ email: string; used: boolean; expiresAt: Date } | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<void>;
  updateUserPassword(email: string, hashedPassword: string): Promise<void>;

  // Session store for authentication
  sessionStore: session.Store;

  // Chat operations
  getConversations(): Promise<any[]>;
  createConversation(conversation: any): Promise<any>;
  getMessages(conversationId: number): Promise<any[]>;
  createMessage(message: any): Promise<any>;
  addParticipantToConversation(conversationId: number, userId: number): Promise<boolean>;
  updateConversationLastActivity(conversationId: number): Promise<void>;
  markConversationMessagesAsSeen(conversationId: number, userId: number): Promise<void>;

  // Deliverable operations
  getDeliverablesByProjects(projectIds: number[]): Promise<Deliverable[]>;
  createDeliverable(deliverable: any): Promise<Deliverable>;
  updateDeliverable(id: number, data: any): Promise<Deliverable | undefined>;
  deleteDeliverablesByProject(projectId: number): Promise<void>;

  // Client MODO operations
  getClientModoComments(clientId: number): Promise<ClientModoComment[]>;
  createClientModoComment(comment: any): Promise<ClientModoComment>;
  getClientStatistics(clientId: number): Promise<{
    totalDeliverables: number;
    onTimeDeliveries: number;
    deliveryRate: number;
    qualityScores: {
      narrativeQuality: number;
      graphicsEffectiveness: number;
      formatDesign: number;
      relevantInsights: number;
      operationsFeedback: number;
      clientFeedback: number;
      briefCompliance: number;
    };
    totalComments: number;
    latestComment?: ClientModoComment;
  }>;

  // NPS Survey operations
  getNpsSurveysByClient(clientId: number): Promise<QuarterlyNpsSurvey[]>;
  getNpsSurvey(id: number): Promise<QuarterlyNpsSurvey | undefined>;
  createNpsSurvey(survey: InsertQuarterlyNpsSurvey): Promise<QuarterlyNpsSurvey>;
  updateNpsSurvey(id: number, survey: Partial<InsertQuarterlyNpsSurvey>): Promise<QuarterlyNpsSurvey | undefined>;
  deleteNpsSurvey(id: number): Promise<boolean>;

  // Cost Multiplier operations
  getCostMultipliers(): Promise<CostMultiplier[]>;
  getCostMultipliersByCategory(category: string): Promise<CostMultiplier[]>;
  getCostMultiplier(id: number): Promise<CostMultiplier | undefined>;
  updateCostMultiplier(id: number, multiplier: Partial<InsertCostMultiplier>): Promise<CostMultiplier | undefined>;
  createCostMultiplier(multiplier: InsertCostMultiplier): Promise<CostMultiplier>;
  deleteCostMultiplier(id: number): Promise<boolean>;

  // Recurring Template operations
  getRecurringTemplatesByProject(parentProjectId: number): Promise<RecurringProjectTemplate[]>;
  getRecurringTemplate(id: number): Promise<RecurringProjectTemplate | undefined>;
  createRecurringTemplate(template: InsertRecurringProjectTemplate): Promise<RecurringProjectTemplate>;
  updateRecurringTemplate(id: number, template: Partial<InsertRecurringProjectTemplate>): Promise<RecurringProjectTemplate | undefined>;
  deleteRecurringTemplate(id: number): Promise<boolean>;

  // Enhanced Recurring Template operations with team assignment
  getRecurringTemplatesWithTeam(projectId: number): Promise<any[]>;
  createRecurringTemplateWithTeam(template: any): Promise<any>;
  updateRecurringTemplateWithTeam(id: number, template: any): Promise<any>;
  deleteRecurringTemplateWithTeam(id: number): Promise<boolean>;

  // Project Cycle operations
  getProjectCycles(parentProjectId: number): Promise<ProjectCycle[]>;
  getProjectCycle(id: number): Promise<ProjectCycle | undefined>;
  createProjectCycle(cycle: InsertProjectCycle): Promise<ProjectCycle>;
  updateProjectCycle(id: number, cycle: Partial<InsertProjectCycle>): Promise<ProjectCycle | undefined>;
  completeProjectCycle(id: number): Promise<ProjectCycle | undefined>;

  // Automation operations
  autoGenerateSubprojects(parentProjectId: number, templateId: number, periodStart: Date, periodEnd: Date): Promise<ActiveProject[]>;
  checkAndCreatePendingCycles(): Promise<ProjectCycle[]>;

  // Project base team operations
  getProjectBaseTeam(projectId: number): Promise<ProjectBaseTeam[]>;
  createProjectBaseTeam(team: InsertProjectBaseTeam): Promise<ProjectBaseTeam>;
  createProjectBaseTeamMember(team: InsertProjectBaseTeam): Promise<ProjectBaseTeam>;
  updateProjectBaseTeam(id: number, team: Partial<InsertProjectBaseTeam>): Promise<ProjectBaseTeam | undefined>;
  deleteProjectBaseTeam(id: number): Promise<boolean>;
  copyQuotationTeamToProject(quotationId: number, projectId: number): Promise<ProjectBaseTeam[]>;

  // Quick time entry operations
  getQuickTimeEntries(projectId: number): Promise<QuickTimeEntry[]>;
  getQuickTimeEntry(id: number): Promise<QuickTimeEntry | undefined>;
  createQuickTimeEntry(entry: InsertQuickTimeEntry): Promise<QuickTimeEntry>;
  updateQuickTimeEntry(id: number, entry: Partial<InsertQuickTimeEntry>): Promise<QuickTimeEntry | undefined>;
  deleteQuickTimeEntry(id: number): Promise<boolean>;

  // Quick time entry detail operations
  getQuickTimeEntryDetails(quickTimeEntryId: number): Promise<QuickTimeEntryDetail[]>;
  createQuickTimeEntryDetail(detail: InsertQuickTimeEntryDetail): Promise<QuickTimeEntryDetail>;
  updateQuickTimeEntryDetail(id: number, detail: Partial<InsertQuickTimeEntryDetail>): Promise<QuickTimeEntryDetail | undefined>;
  deleteQuickTimeEntryDetail(id: number): Promise<boolean>;
  submitQuickTimeEntry(id: number): Promise<QuickTimeEntry | undefined>;
  approveQuickTimeEntry(id: number, approverId: number): Promise<QuickTimeEntry | undefined>;

  // Unquoted personnel operations
  assignUnquotedPersonnel(projectId: number, personnelId: number, estimatedHours: number, hourlyRate: number): Promise<any>;
  getUnquotedPersonnel(projectId: number): Promise<any[]>;
  getUnquotedPersonnelByProject(projectId: number): Promise<any[]>;
  checkIfPersonnelIsUnquoted(projectId: number, personnelId: number): Promise<boolean>;

  // Monthly Hour Adjustment operations
  getMonthlyHourAdjustments(projectId: number): Promise<any[]>;
  getMonthlyHourAdjustment(projectId: number, personnelId: number, year: number, month: number): Promise<any | undefined>;
  createMonthlyHourAdjustment(adjustment: any): Promise<any>;
  updateMonthlyHourAdjustment(id: number, adjustment: any): Promise<any | undefined>;

  // Project Price Adjustment operations
  getProjectPriceAdjustments(projectId: number): Promise<ProjectPriceAdjustment[]>;
  getProjectPriceAdjustment(id: number): Promise<ProjectPriceAdjustment | undefined>;
  createProjectPriceAdjustment(adjustment: InsertProjectPriceAdjustment): Promise<ProjectPriceAdjustment>;
  updateProjectPriceAdjustment(id: number, adjustment: Partial<InsertProjectPriceAdjustment>): Promise<ProjectPriceAdjustment | undefined>;
  deleteProjectPriceAdjustment(id: number): Promise<boolean>;
  getCurrentProjectPrice(projectId: number): Promise<number>;

  // Exchange Rate operations
  getExchangeRates(): Promise<ExchangeRate[]>;
  getExchangeRateByMonth(year: number, month: number): Promise<ExchangeRate | undefined>;
  createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate>;
  bulkCreateExchangeRates(rates: InsertExchangeRate[]): Promise<ExchangeRate[]>;
  deleteMonthlyHourAdjustment(id: number): Promise<boolean>;

  // Personnel Historical Costs operations (usando campos en personnel)
  getEffectivePersonnelCostForPeriod(personnelId: number, year: number, month: number): Promise<number | undefined>;

  // Indirect Cost Category operations
  getIndirectCostCategories(): Promise<IndirectCostCategory[]>;
  getIndirectCostCategory(id: number): Promise<IndirectCostCategory | undefined>;
  createIndirectCostCategory(category: InsertIndirectCostCategory): Promise<IndirectCostCategory>;
  updateIndirectCostCategory(id: number, category: Partial<InsertIndirectCostCategory>): Promise<IndirectCostCategory | undefined>;
  deleteIndirectCostCategory(id: number): Promise<boolean>;

  // Indirect Cost operations
  getIndirectCosts(): Promise<IndirectCost[]>;
  getIndirectCostsByCategory(categoryId: number): Promise<IndirectCost[]>;
  getIndirectCost(id: number): Promise<IndirectCost | undefined>;
  createIndirectCost(cost: InsertIndirectCost): Promise<IndirectCost>;
  updateIndirectCost(id: number, cost: Partial<InsertIndirectCost>): Promise<IndirectCost | undefined>;
  deleteIndirectCost(id: number): Promise<boolean>;
  
  // Non-Billable Hours operations
  getNonBillableHours(): Promise<NonBillableHours[]>;
  getNonBillableHoursByPersonnel(personnelId: number): Promise<NonBillableHours[]>;
  getNonBillableHoursByCategory(categoryId: number): Promise<NonBillableHours[]>;
  createNonBillableHours(hours: InsertNonBillableHours): Promise<NonBillableHours>;
  updateNonBillableHours(id: number, hours: Partial<InsertNonBillableHours>): Promise<NonBillableHours | undefined>;
  deleteNonBillableHours(id: number): Promise<boolean>;

  // Google Sheets Projects operations
  getGoogleSheetsProjects(): Promise<GoogleSheetsProject[]>;
  getGoogleSheetsProject(id: number): Promise<GoogleSheetsProject | undefined>;
  getGoogleSheetsProjectByKey(googleSheetsKey: string): Promise<GoogleSheetsProject | undefined>;
  createGoogleSheetsProject(project: InsertGoogleSheetsProject): Promise<GoogleSheetsProject>;
  updateGoogleSheetsProject(id: number, project: Partial<InsertGoogleSheetsProject>): Promise<GoogleSheetsProject | undefined>;
  deleteGoogleSheetsProject(id: number): Promise<boolean>;

  // Google Sheets Project Billing operations
  getProjectBillingRecords(projectId: number): Promise<GoogleSheetsProjectBilling[]>;
  getProjectBillingRecord(id: number): Promise<GoogleSheetsProjectBilling | undefined>;
  createProjectBillingRecord(billing: InsertGoogleSheetsProjectBilling): Promise<GoogleSheetsProjectBilling>;
  updateProjectBillingRecord(id: number, billing: Partial<InsertGoogleSheetsProjectBilling>): Promise<GoogleSheetsProjectBilling | undefined>;
  deleteProjectBillingRecord(id: number): Promise<boolean>;

  // Import operations
  importGoogleSheetsProjects(projectsData: any[]): Promise<{ imported: number; updated: number; errors: string[] }>;

  // ==================== FINANCIAL MANAGEMENT ====================
  // Monthly Revenue operations
  getProjectMonthlyRevenue(projectId: number): Promise<ProjectMonthlyRevenue[]>;
  getProjectMonthlyRevenueByPeriod(projectId: number, year: number, month: number): Promise<ProjectMonthlyRevenue | undefined>;
  createProjectMonthlyRevenue(revenue: InsertProjectMonthlyRevenue): Promise<ProjectMonthlyRevenue>;
  updateProjectMonthlyRevenue(id: number, revenue: Partial<InsertProjectMonthlyRevenue>): Promise<ProjectMonthlyRevenue | undefined>;
  deleteProjectMonthlyRevenue(id: number): Promise<boolean>;
  
  // Pricing Changes operations
  getProjectPricingChanges(projectId: number): Promise<ProjectPricingChange[]>;
  getCurrentProjectPricing(projectId: number, year: number, month: number): Promise<ProjectPricingChange | undefined>;
  createProjectPricingChange(change: InsertProjectPricingChange): Promise<ProjectPricingChange>;
  
  // Financial Summary operations
  getProjectFinancialSummary(projectId: number): Promise<ProjectFinancialSummary | undefined>;
  updateProjectFinancialSummary(projectId: number, summary: Partial<InsertProjectFinancialSummary>): Promise<ProjectFinancialSummary>;
  calculateAndUpdateFinancialSummary(projectId: number): Promise<ProjectFinancialSummary>;
  
  // Business Intelligence operations
  generateProjectFinancialReport(projectId: number): Promise<{
    totalRevenue: number;
    totalInvoiced: number;
    totalCollected: number;
    monthlyBreakdown: Array<{
      year: number;
      month: number;
      amount: number;
      invoiced: boolean;
      collected: boolean;
    }>;
  }>;
  
  // Bulk Revenue Generation for Fee Projects
  generateMonthlyRevenueForProject(projectId: number, fromYear: number, fromMonth: number, toYear: number, toMonth: number): Promise<ProjectMonthlyRevenue[]>;

  // ==================== NUEVOS MÉTODOS PARA ANÁLISIS OPERACIONAL Y FINANCIERO ====================
  // Project Monthly Sales operations (análisis operacional)
  getProjectMonthlySales(projectId: number): Promise<ProjectMonthlySales[]>;
  getProjectMonthlySalesByPeriod(projectId: number, year: number, month: number): Promise<ProjectMonthlySales | undefined>;
  createProjectMonthlySales(sales: InsertProjectMonthlySales): Promise<ProjectMonthlySales>;
  updateProjectMonthlySales(id: number, sales: Partial<InsertProjectMonthlySales>): Promise<ProjectMonthlySales | undefined>;
  deleteProjectMonthlySales(id: number): Promise<boolean>;
  
  // Project Financial Transactions operations (análisis financiero)
  getProjectFinancialTransactions(projectId: number): Promise<ProjectFinancialTransaction[]>;
  getProjectFinancialTransaction(id: number): Promise<ProjectFinancialTransaction | undefined>;
  createProjectFinancialTransaction(transaction: InsertProjectFinancialTransaction): Promise<ProjectFinancialTransaction>;
  updateProjectFinancialTransaction(id: number, transaction: Partial<InsertProjectFinancialTransaction>): Promise<ProjectFinancialTransaction | undefined>;
  deleteProjectFinancialTransaction(id: number): Promise<boolean>;

  // ==================== GOOGLE SHEETS SALES IMPORT ====================
  // Google Sheets Sales operations
  getGoogleSheetsSales(): Promise<GoogleSheetsSales[]>;
  getGoogleSheetsSalesByProject(projectId: number): Promise<GoogleSheetsSales[]>;
  createGoogleSheetsSales(sales: InsertGoogleSheetsSales): Promise<GoogleSheetsSales>;
  updateGoogleSheetsSales(id: number, sales: Partial<InsertGoogleSheetsSales>): Promise<GoogleSheetsSales | undefined>;
  deleteGoogleSheetsSales(id: number): Promise<boolean>;
  importSalesFromGoogleSheets(salesData: any[]): Promise<{ imported: number; updated: number; errors: string[] }>;
  clearGoogleSheetsSales(): Promise<boolean>;

  // Direct Costs operations
  getDirectCosts(): Promise<DirectCost[]>;
  getDirectCost(id: number): Promise<DirectCost | undefined>;
  getDirectCostByUniqueKey(uniqueKey: string): Promise<DirectCost | undefined>;
  getDirectCostsByProject(projectId: number): Promise<DirectCost[]>;
  getDirectCostsByPersonnel(personnelId: number): Promise<DirectCost[]>;
  createDirectCost(cost: InsertDirectCost): Promise<DirectCost>;
  updateDirectCost(id: number, cost: Partial<InsertDirectCost>): Promise<DirectCost | undefined>;
  deleteDirectCost(id: number): Promise<boolean>;
  clearDirectCosts(): Promise<boolean>;

  // Personnel lookup
  getPersonnelByName(name: string): Promise<Personnel | undefined>;
  
  // Project activity range for one-shot projects
  getProjectActivityRange(projectId: number): Promise<{ startPeriod: string; endPeriod: string; isActive: boolean } | null>;
  
  // Income Dashboard operations
  listIncomeRows(filters?: {
    projectId?: number;
    timeFilter?: string;
    clientName?: string;
    revenueType?: string;
    status?: string;
  }): Promise<IncomeRecord[]>;

  // Direct Costs operations
  getAllDirectCosts(): Promise<DirectCost[]>;
  upsertDirectCost(costData: InsertDirectCost): Promise<{ isNew: boolean; record: DirectCost }>;
}

// IMPLEMENTACIÓN UNIFICADA DE BASE DE DATOS
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  db: typeof db;

  constructor() {
    this.db = db;
    const PgStore = connectPgSimple(session);
    this.sessionStore = new PgStore({
      pool,
      tableName: 'sessions',
      createTableIfMissing: true,
      pruneSessionInterval: 86400,
      errorLog: (err: any) => {
        console.error('ERROR CRÍTICO EN SESSION STORE:', err);
      },
      disableTouch: false,
      ttl: 60 * 60 * 24 * 30, // 30 días en segundos
    });

    // Verificar que el store se inicialice correctamente
    console.log('✅ Session store initialized');
    
    // Test de conexión del store
    this.sessionStore.on?.('connect', () => {
      console.log('✅ Session store connected to database');
    });

    this.sessionStore.on?.('disconnect', () => {
      console.log('❌ Session store disconnected from database');
    });
  }

  // **VALIDACIÓN CRÍTICA 1: VALIDACIÓN DE PRESUPUESTO EN TIME ENTRIES**
  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    // Obtener información del proyecto y personal para validar presupuesto
    const project = await this.getActiveProject(entry.projectId);
    const personnel = await this.getPersonnelById(entry.personnelId);

    if (!project || !personnel) {
      throw new Error("Proyecto o personal no encontrado");
    }

    // Solo validar presupuesto en proyectos que NO sean "always on" (fee-mensual)
    // Los contratos "always on" pueden exceder el costo estimado mensual
    const isAlwaysOnContract = project.quotation.projectType === 'fee-mensual';
    
    if (!isAlwaysOnContract) {
      // Calcular costo de esta entrada
      const entryCost = entry.hours * personnel.hourlyRate;

      // Obtener total gastado hasta ahora
      const existingEntries = await this.getTimeEntriesByProject(entry.projectId);
      const currentCost = await this.calculateProjectTotalCost(entry.projectId);

      // Validar límite de presupuesto
      const totalBudget = project.quotation.baseCost || 0;
      if (currentCost + entryCost > totalBudget) {
        throw new Error(`Esta entrada excedería el presupuesto del proyecto. Límite: $${totalBudget}, Actual: $${currentCost}, Nueva entrada: $${entryCost}`);
      }

      // Alerta cuando se acerca al límite (90%)
      if (currentCost + entryCost > totalBudget * 0.9) {
        console.warn(`ALERTA: El proyecto ${project.id} está cerca del límite de presupuesto (${((currentCost + entryCost) / totalBudget * 100).toFixed(1)}%)`);
      }
    } else {
      console.log(`📊 Registro de horas en contrato Always On: ${project.quotation.projectName} - Sin validación de presupuesto`);
    }

    const [newEntry] = await db.insert(timeEntries).values(entry).returning();
    return newEntry;
  }

  // **VALIDACIÓN CRÍTICA 2: PREVENIR RELACIONES CIRCULARES EN PROYECTOS**
  async createActiveProject(project: InsertActiveProject): Promise<ActiveProject> {
    // Validar relaciones parent-child para evitar ciclos
    if (project.parentProjectId) {
      const isValidParent = await this.validateProjectHierarchy(project.parentProjectId, project.quotationId);
      if (!isValidParent) {
        throw new Error("La relación padre-hijo crearía un ciclo en la jerarquía de proyectos");
      }
    }

    const [newProject] = await db.insert(activeProjects).values(project).returning();
    return newProject;
  }

  async updateActiveProject(id: number, project: Partial<InsertActiveProject>): Promise<ActiveProject | undefined> {
    // Validar relaciones parent-child si se está actualizando parentProjectId
    if (project.parentProjectId !== undefined) {
      if (project.parentProjectId === id) {
        throw new Error("Un proyecto no puede ser padre de sí mismo");
      }

      if (project.parentProjectId) {
        const isValidParent = await this.validateProjectHierarchy(project.parentProjectId, id);
        if (!isValidParent) {
          throw new Error("La relación padre-hijo crearía un ciclo en la jerarquía de proyectos");
        }
      }
    }

    const [updatedProject] = await db
      .update(activeProjects)
      .set(project)
      .where(eq(activeProjects.id, id))
      .returning();
    return updatedProject;
  }

  // **VALIDACIÓN CRÍTICA 3: ELIMINACIÓN SEGURA CON CONSTRAINTS**
  async deleteActiveProject(id: number): Promise<boolean> {
    try {

      // Usar transacción para garantizar integridad
      await db.transaction(async (tx) => {
        // 1. Eliminar conversaciones de chat
        await tx.delete(chatConversations).where(eq(chatConversations.projectId, id));

        // 2. Eliminar entradas de tiempo
        await tx.delete(timeEntries).where(eq(timeEntries.projectId, id));

        // 3. Eliminar informes de progreso
        await tx.delete(progressReports).where(eq(progressReports.projectId, id));

        // 4. Eliminar componentes del proyecto
        await tx.delete(projectComponents).where(eq(projectComponents.projectId, id));

        // 5. Eliminar equipos base del proyecto (importante para proyectos Always-On)
        await tx.delete(projectBaseTeam).where(eq(projectBaseTeam.projectId, id));

        // 5.1. Eliminar personal no cotizado del proyecto
        await tx.delete(unquotedPersonnel).where(eq(unquotedPersonnel.projectId, id));

        // 5.2. Eliminar ajustes mensuales de horas del proyecto
        await tx.delete(monthlyHourAdjustments).where(eq(monthlyHourAdjustments.projectId, id));

        // 6. Eliminar entregables relacionados
        await tx.delete(deliverables).where(eq(deliverables.project_id, id));

        // 7. Eliminar ciclos de proyecto como padre
        await tx.delete(projectCycles).where(eq(projectCycles.parentProjectId, id));

        // 8. Eliminar ciclos de proyecto como subproyecto
        await tx.delete(projectCycles).where(eq(projectCycles.subprojectId, id));

        // 9. Eliminar plantillas de proyectos recurrentes que referencian este proyecto
        await tx.delete(recurringProjectTemplates).where(eq(recurringProjectTemplates.parentProjectId, id));

        // 10. Eliminar entradas de tiempo rápido
        await tx.delete(quickTimeEntries).where(eq(quickTimeEntries.projectId, id));

        // 11. Actualizar proyectos hijos para quitar la referencia padre
        await tx.update(activeProjects)
          .set({ parentProjectId: null })
          .where(eq(activeProjects.parentProjectId, id));

        // 12. Finalmente eliminar el proyecto
        await tx.delete(activeProjects).where(eq(activeProjects.id, id));
      });

      return true;
    } catch (error) {
      console.error("Error al eliminar el proyecto activo:", error);
      return false;
    }
  }

  // **MÉTODOS DE VALIDACIÓN Y UTILIDAD**
  private async validateProjectHierarchy(parentId: number, childId: number): Promise<boolean> {
    // Verificar que el padre no sea descendiente del hijo (prevenir ciclos)
    const checkCycle = async (currentId: number, targetId: number, visited: Set<number> = new Set()): Promise<boolean> => {
      if (visited.has(currentId)) return false; // Ciclo detectado
      if (currentId === targetId) return false; // Ciclo directo

      visited.add(currentId);

      const [parent] = await db.select()
        .from(activeProjects)
        .where(eq(activeProjects.id, currentId));

      if (!parent || !parent.parentProjectId) return true;

      return await checkCycle(parent.parentProjectId, targetId, visited);
    };

    return await checkCycle(parentId, childId);
  }

  private async calculateProjectTotalCost(projectId: number): Promise<number> {
    const entries = await this.getTimeEntriesByProject(projectId);
    let totalCost = 0;

    for (const entry of entries) {
      const personnel = await this.getPersonnelById(entry.personnelId);
      if (personnel) {
        totalCost += entry.hours * personnel.hourlyRate;
      }
    }

    return totalCost;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Password reset operations
  async createPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({
      email,
      token,
      expiresAt,
      used: false,
    });
  }

  async getPasswordResetToken(token: string): Promise<{ email: string; used: boolean; expiresAt: Date } | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    
    if (!resetToken) return undefined;
    
    return {
      email: resetToken.email,
      used: resetToken.used,
      expiresAt: resetToken.expiresAt,
    };
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async updateUserPassword(email: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email));
  }

  // Client operations
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.name, name));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    try {
      const [updatedClient] = await db
        .update(clients)
        .set(client)
        .where(eq(clients.id, id))
        .returning();
      return updatedClient;
    } catch (error) {
      console.error("Error al actualizar cliente:", error);
      return undefined;
    }
  }

  async deleteClient(id: number): Promise<boolean> {
    try {
      // Check if client has active projects or quotations
      const clientActiveProjects = await db.select().from(activeProjects).where(eq(activeProjects.clientId, id));
      const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, id));
      
      if (clientActiveProjects.length > 0 || clientQuotations.length > 0) {
        console.log(`Cannot delete client ${id}: has ${clientActiveProjects.length} active projects and ${clientQuotations.length} quotations`);
        return false;
      }

      // Use transaction to ensure safe deletion
      await db.transaction(async (tx) => {
        // Delete related records first
        await tx.delete(clientModoComments).where(eq(clientModoComments.clientId, id));
        
        // Finally delete the client
        await tx.delete(clients).where(eq(clients.id, id));
      });

      return true;
    } catch (error) {
      console.error("Error deleting client:", error);
      return false;
    }
  }

  // Role operations
  async getRoles(): Promise<Role[]> {
    // Order roles by ID to ensure consistent ordering
    // This prevents Operations Lead (id=16) from always being first
    return await db.select().from(roles).orderBy(asc(roles.id));
  }

  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role;
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [newRole] = await db.insert(roles).values(role).returning();
    return newRole;
  }

  async updateRole(id: number, role: Partial<InsertRole>): Promise<Role | undefined> {
    const [updatedRole] = await db
      .update(roles)
      .set(role)
      .where(eq(roles.id, id))
      .returning();
    return updatedRole;
  }

  async deleteRole(id: number): Promise<boolean> {
    await db.delete(roles).where(eq(roles.id, id));
    const role = await db.select().from(roles).where(eq(roles.id, id));
    return role.length === 0;
  }

  // Personnel operations
  async getPersonnel(): Promise<Personnel[]> {
    return await db.select().from(personnel);
  }

  async getPersonnelByRole(roleId: number): Promise<Personnel[]> {
    return await db.select().from(personnel).where(eq(personnel.roleId, roleId));
  }

  async getPersonnelById(id: number): Promise<Personnel | undefined> {
    const [person] = await db.select().from(personnel).where(eq(personnel.id, id));
    return person;
  }

  async createPersonnel(person: InsertPersonnel): Promise<Personnel> {
    const [newPerson] = await db.insert(personnel).values(person).returning();
    return newPerson;
  }

  async updatePersonnel(id: number, person: Partial<InsertPersonnel>): Promise<Personnel | undefined> {
    try {
      // Get current person for logging
      const currentPerson = await this.getPersonnelById(id);
      const personName = currentPerson?.name || `ID${id}`;
      
      console.log(`💾 [${personName}] STORAGE: Updating personnel ${id} with data:`, person);
      
      if (person.monthlyHours !== undefined) {
        console.log(`💾 [${personName}] STORAGE: Monthly hours update - Before: ${currentPerson?.monthlyHours}, After: ${person.monthlyHours}`);
      }
      
      const [updatedPerson] = await db
        .update(personnel)
        .set(person)
        .where(eq(personnel.id, id))
        .returning();
      
      console.log(`💾 [${personName}] STORAGE: Personnel updated successfully:`, updatedPerson);
      
      if (person.monthlyHours !== undefined) {
        console.log(`💾 [${personName}] STORAGE: Final monthly hours in DB: ${updatedPerson.monthlyHours}`);
      }
      
      return updatedPerson;
    } catch (error) {
      console.error(`💾 STORAGE ERROR: Failed to update personnel ${id}:`, error);
      throw error;
    }
  }

  async getPersonnelDependencies(id: number): Promise<{
    timeEntries: number;
    quotations: Array<{ id: number; projectName: string }>;
    projects: Array<{ id: number; name: string }>;
  }> {
    try {
      const timeEntriesCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(timeEntries)
        .where(eq(timeEntries.personnelId, id));
      
      const quotationsWithPersonnel = await db.select({
        id: quotations.id,
        projectName: quotations.projectName
      })
      .from(quotations)
      .innerJoin(quotationTeamMembers, eq(quotations.id, quotationTeamMembers.quotationId))
      .where(eq(quotationTeamMembers.personnelId, id));
      
      const projectsWithPersonnel = await db.select({
        id: activeProjects.id,
        name: sql<string>`COALESCE(${activeProjects.subprojectName}, 'Proyecto sin nombre')`,
        quotationId: activeProjects.quotationId
      })
      .from(activeProjects)
      .innerJoin(projectBaseTeam, eq(activeProjects.id, projectBaseTeam.projectId))
      .where(eq(projectBaseTeam.personnelId, id));

      // Para proyectos, obtener el nombre real de la cotización
      const projectsWithNames = await Promise.all(
        projectsWithPersonnel.map(async (project) => {
          if (project.quotationId) {
            const [quotation] = await db.select({ projectName: quotations.projectName })
              .from(quotations)
              .where(eq(quotations.id, project.quotationId));
            
            return {
              id: project.id,
              name: quotation?.projectName || project.name
            };
          }
          return { id: project.id, name: project.name };
        })
      );

      return {
        timeEntries: timeEntriesCount?.[0]?.count || 0,
        quotations: quotationsWithPersonnel || [],
        projects: projectsWithNames || []
      };
    } catch (error) {
      console.error("Error in getPersonnelDependencies:", error);
      return {
        timeEntries: 0,
        quotations: [],
        projects: []
      };
    }
  }

  async deletePersonnel(id: number): Promise<boolean> {
    try {
      const dependencies = await this.getPersonnelDependencies(id);
      
      if (dependencies.timeEntries > 0 || dependencies.quotations.length > 0 || dependencies.projects.length > 0) {
        return false; // No se puede eliminar porque tiene referencias
      }

      await db.delete(personnel).where(eq(personnel.id, id));
      const person = await db.select().from(personnel).where(eq(personnel.id, id));
      return person.length === 0;
    } catch (error) {
      console.error("Error in deletePersonnel:", error);
      return false;
    }
  }

  // Template operations
  async getReportTemplates(): Promise<ReportTemplate[]> {
    return await db.select().from(reportTemplates);
  }

  async getReportTemplate(id: number): Promise<ReportTemplate | undefined> {
    const [template] = await db.select().from(reportTemplates).where(eq(reportTemplates.id, id));
    return template;
  }

  async createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate> {
    const [newTemplate] = await db.insert(reportTemplates).values(template).returning();
    return newTemplate;
  }

  async updateReportTemplate(id: number, template: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(reportTemplates)
      .set(template)
      .where(eq(reportTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteReportTemplate(id: number): Promise<boolean> {
    // Primero eliminar todas las asignaciones de roles asociadas a esta plantilla
    await db.delete(templateRoleAssignments).where(eq(templateRoleAssignments.templateId, id));

    // Luego eliminar la plantilla
    await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
    const template = await db.select().from(reportTemplates).where(eq(reportTemplates.id, id));
    return template.length === 0;
  }

  // Quotation operations
  async getQuotations(): Promise<Quotation[]> {
    return await db.select().from(quotations);
  }

  async getQuotationsByClient(clientId: number): Promise<Quotation[]> {
    return await db.select().from(quotations).where(eq(quotations.clientId, clientId));
  }

  async getQuotation(id: number): Promise<Quotation | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation;
  }

  async createQuotation(quotation: InsertQuotation): Promise<Quotation> {
    const [newQuotation] = await db.insert(quotations).values(quotation).returning();
    return newQuotation;
  }

  async updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined> {
    const [updatedQuotation] = await db
      .update(quotations)
      .set(quotation)
      .where(eq(quotations.id, id))
      .returning();
    return updatedQuotation;
  }

  async deleteQuotation(id: number): Promise<boolean> {
    try {
      // Primero eliminar las variantes de cotización
      await db.delete(quotationVariants).where(eq(quotationVariants.quotationId, id));
      
      // Luego eliminar los miembros del equipo
      await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.quotationId, id));
      
      // Finalmente eliminar la cotización
      const result = await db.delete(quotations).where(eq(quotations.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error(`❌ Error eliminando cotización ${id}:`, error);
      throw error;
    }
  }

  // Negotiation history operations
  async getNegotiationHistory(quotationId: number): Promise<NegotiationHistory[]> {
    return await db.select()
      .from(negotiationHistory)
      .where(eq(negotiationHistory.quotationId, quotationId))
      .orderBy(desc(negotiationHistory.createdAt));
  }

  async createNegotiationHistory(history: InsertNegotiationHistory): Promise<NegotiationHistory> {
    const [newHistory] = await db.insert(negotiationHistory).values(history).returning();
    return newHistory;
  }

  async getLatestNegotiation(quotationId: number): Promise<NegotiationHistory | undefined> {
    const [latest] = await db.select()
      .from(negotiationHistory)
      .where(eq(negotiationHistory.quotationId, quotationId))
      .orderBy(desc(negotiationHistory.createdAt))
      .limit(1);
    return latest;
  }

  // Quotation team member operations
  async getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]> {
    console.log(`📊 Storage: Getting team members for quotation ${quotationId}`);

    try {
      // Primero obtener los miembros básicos
      const basicMembers = await db.select().from(quotationTeamMembers).where(eq(quotationTeamMembers.quotationId, quotationId));
      
      // Luego enriquecer con datos de personal y roles
      const enrichedMembers = await Promise.all(
        basicMembers.map(async (member) => {
          // Solo buscar datos de personal si hay un personnelId
          let personnelData = null;
          if (member.personnelId) {
            const personnelResult = await db.select().from(personnel).where(eq(personnel.id, member.personnelId));
            personnelData = personnelResult[0];
          }
          
          const roleData = await db.select().from(roles).where(eq(roles.id, member.roleId!));
          
          return {
            ...member,
            // Si no hay personnelId, devolver valores vacíos para mantener la estructura
            personnelName: personnelData?.name || '',
            personnelEmail: personnelData?.email || '',
            personnelHourlyRate: personnelData?.hourlyRate || 0,
            roleName: roleData[0]?.name || 'Unknown Role',
            roleDescription: roleData[0]?.description || ''
          };
        })
      );
      
      console.log(`📊 Storage: Found ${enrichedMembers.length} team members for quotation ${quotationId} with complete data:`, enrichedMembers.slice(0, 2));
      return enrichedMembers;
    } catch (error) {
      console.error(`❌ Storage: Error getting team members for quotation ${quotationId}:`, error);
      throw error;
    }
  }

  async getQuotationTeamMembersByVariant(variantId: number): Promise<QuotationTeamMember[]> {
    console.log(`📊 Storage: Getting team members for variant ${variantId}`);
    
    try {
      const basicMembers = await db.select().from(quotationTeamMembers).where(eq(quotationTeamMembers.variantId, variantId));
      
      const enrichedMembers = await Promise.all(
        basicMembers.map(async (member) => {
          let personnelData = null;
          if (member.personnelId) {
            const personnelResult = await db.select().from(personnel).where(eq(personnel.id, member.personnelId));
            personnelData = personnelResult[0];
          }
          
          const roleData = await db.select().from(roles).where(eq(roles.id, member.roleId!));
          
          return {
            ...member,
            personnelName: personnelData?.name || '',
            personnelEmail: personnelData?.email || '',
            personnelHourlyRate: personnelData?.hourlyRate || 0,
            roleName: roleData[0]?.name || 'Unknown Role',
            roleDescription: roleData[0]?.description || ''
          };
        })
      );
      
      console.log(`📊 Storage: Found ${enrichedMembers.length} team members for variant ${variantId}`);
      return enrichedMembers;
    } catch (error) {
      console.error(`❌ Storage: Error getting team members for variant ${variantId}:`, error);
      throw error;
    }
  }

  async createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember> {
    console.log('📝 Creando miembro del equipo con datos:', {
      quotationId: member.quotationId,
      variantId: member.variantId,
      personnelId: member.personnelId,
      roleId: member.roleId,
      hours: member.hours,
      rate: member.rate,
      cost: member.cost
    });

    // Validar que los datos mínimos estén presentes
    if (!member.quotationId) {
      throw new Error('quotation_id es requerido para crear un miembro del equipo');
    }
    
    const [newMember] = await db.insert(quotationTeamMembers).values(member).returning();
    console.log('✅ Miembro del equipo creado exitosamente:', newMember);
    return newMember;
  }

  async updateQuotationTeamMember(id: number, member: Partial<InsertQuotationTeamMember>): Promise<QuotationTeamMember | undefined> {
    const [updatedMember] = await db
      .update(quotationTeamMembers)
      .set(member)
      .where(eq(quotationTeamMembers.id, id))
      .returning();
    return updatedMember;
  }

  async deleteQuotationTeamMember(id: number): Promise<boolean> {
    await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.id, id));
    const member = await db.select().from(quotationTeamMembers).where(eq(quotationTeamMembers.id, id));
    return member.length === 0;
  }

  async deleteQuotationTeamMemberById(id: number): Promise<void> {
    await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.id, id));
  }

  // Template role assignment operations
  async getTemplateRoleAssignments(templateId: number): Promise<TemplateRoleAssignment[]> {
    return await db.select().from(templateRoleAssignments).where(eq(templateRoleAssignments.templateId, templateId));
  }

  async getTemplateRoleAssignmentsWithRoles(templateId: number): Promise<(TemplateRoleAssignment & { role: Role })[]> {
    const assignments = await db.select({
      assignment: templateRoleAssignments,
      role: roles
    })
    .from(templateRoleAssignments)
    .innerJoin(roles, eq(templateRoleAssignments.roleId, roles.id))
    .where(eq(templateRoleAssignments.templateId, templateId));

    return assignments.map(item => ({
      ...item.assignment,
      role: item.role
    }));
  }

  async createTemplateRoleAssignment(assignment: InsertTemplateRoleAssignment): Promise<TemplateRoleAssignment> {
    const [newAssignment] = await db.insert(templateRoleAssignments).values(assignment).returning();
    return newAssignment;
  }

  async updateTemplateRoleAssignment(id: number, assignment: Partial<InsertTemplateRoleAssignment>): Promise<TemplateRoleAssignment | undefined> {
    const [updatedAssignment] = await db
      .update(templateRoleAssignments)
      .set(assignment)
      .where(eq(templateRoleAssignments.id, id))
      .returning();
    return updatedAssignment;
  }

  async deleteTemplateRoleAssignment(id: number): Promise<boolean> {
    await db.delete(templateRoleAssignments).where(eq(templateRoleAssignments.id, id));
    const assignment = await db.select().from(templateRoleAssignments).where(eq(templateRoleAssignments.id, id));
    return assignment.length === 0;
  }

  async deleteTemplateRoleAssignments(templateId: number): Promise<void> {
    await db.delete(templateRoleAssignments).where(eq(templateRoleAssignments.templateId, templateId));
  }

  // Quotation variant operations
  async getQuotationVariants(quotationId: number): Promise<QuotationVariant[]> {
    console.log(`📊 Storage: Getting variants for quotation ${quotationId}`);
    return await db.select()
      .from(quotationVariants)
      .where(eq(quotationVariants.quotationId, quotationId))
      .orderBy(asc(quotationVariants.variantOrder));
  }

  async getQuotationVariant(id: number): Promise<QuotationVariant | undefined> {
    const [variant] = await db.select().from(quotationVariants).where(eq(quotationVariants.id, id));
    return variant;
  }

  async createQuotationVariant(variant: InsertQuotationVariant): Promise<QuotationVariant> {
    console.log('📝 Creating quotation variant:', variant);
    const [newVariant] = await db.insert(quotationVariants).values(variant).returning();
    console.log('✅ Quotation variant created successfully:', newVariant);
    return newVariant;
  }

  async updateQuotationVariant(id: number, variant: Partial<InsertQuotationVariant>): Promise<QuotationVariant | undefined> {
    const [updatedVariant] = await db
      .update(quotationVariants)
      .set(variant)
      .where(eq(quotationVariants.id, id))
      .returning();
    return updatedVariant;
  }

  async deleteQuotationVariant(id: number): Promise<boolean> {
    // First delete all team members associated with this variant
    await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.variantId, id));
    
    // Then delete the variant
    const result = await db.delete(quotationVariants).where(eq(quotationVariants.id, id)).returning();
    return result.length > 0;
  }

  // Get option lists
  async getAnalysisTypes() {
    return analysisTypes;
  }

  async getProjectTypes() {
    return projectTypes;
  }

  async getProjectDurationOptions(projectType: string): Promise<{value: string, label: string}[]> {
    const { projectDurationOptions } = await import("@shared/schema");
    if (projectType === 'on-demand') {
      return projectDurationOptions["on-demand"];
    } else if (projectType === 'fee-mensual') {
      return projectDurationOptions["fee-mensual"];
    }
    return [];
  }

  async getMentionsVolumeOptions() {
    return mentionsVolumeOptions;
  }

  async getCountriesCoveredOptions() {
    return countriesCoveredOptions;
  }

  async getClientEngagementOptions() {
    return clientEngagementOptions;
  }

  async getProjectStatusOptions() {
    return projectStatusOptions;
  }

  async getTrackingFrequencyOptions() {
    return trackingFrequencyOptions;
  }

  // Active project operations
  async getActiveProjects(): Promise<(ActiveProject & { quotation: Quotation & { client?: Client } })[]> {
    const projects = await db.select({
      project: activeProjects,
      quotation: quotations,
      client: clients
    })
    .from(activeProjects)
    .innerJoin(quotations, eq(activeProjects.quotationId, quotations.id))
    .leftJoin(clients, eq(quotations.clientId, clients.id));

    return projects.map(item => ({
      ...item.project,
      quotation: {
        ...item.quotation,
        client: item.client || undefined
      }
    }));
  }

  async getActiveProjectsByClient(clientId: number): Promise<(ActiveProject & { quotation: Quotation })[]> {
    const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, clientId));
    const clientQuotationIds = clientQuotations.map(q => q.id);

    const result = [];
    for (const quotationId of clientQuotationIds) {
      const projects = await db.select({
        project: activeProjects,
        quotation: quotations
      })
      .from(activeProjects)
      .innerJoin(quotations, eq(activeProjects.quotationId, quotations.id))
      .where(eq(quotations.id, quotationId));

      for (const item of projects) {
        result.push({
          ...item.project,
          quotation: item.quotation
        });
      }
    }

    return result;
  }

  async getActiveProject(id: number): Promise<(ActiveProject & { quotation: Quotation & { client?: Client } }) | undefined> {
    const projects = await db.select({
      project: activeProjects,
      quotation: quotations,
      client: clients
    })
    .from(activeProjects)
    .innerJoin(quotations, eq(activeProjects.quotationId, quotations.id))
    .leftJoin(clients, eq(quotations.clientId, clients.id))
    .where(eq(activeProjects.id, id));

    if (projects.length === 0) return undefined;

    const item = projects[0];
    return {
      ...item.project,
      quotation: {
        ...item.quotation,
        client: item.client || undefined
      }
    };
  }

  // Project component operations
  async getProjectComponents(projectId: number): Promise<ProjectComponent[]> {
    return await db.select().from(projectComponents).where(eq(projectComponents.projectId, projectId));
  }

  async createProjectComponent(component: InsertProjectComponent): Promise<ProjectComponent> {
    const [newComponent] = await db.insert(projectComponents).values(component).returning();
    return newComponent;
  }

  async updateProjectComponent(id: number, component: Partial<InsertProjectComponent>): Promise<ProjectComponent | undefined> {
    const [updatedComponent] = await db
      .update(projectComponents)
      .set(component)
      .where(eq(projectComponents.id, id))
      .returning();
    return updatedComponent;
  }

  async deleteProjectComponent(id: number): Promise<boolean> {
    await db.delete(projectComponents).where(eq(projectComponents.id, id));
    const component = await db.select().from(projectComponents).where(eq(projectComponents.id, id));
    return component.length === 0;
  }

  // Time entry operations
  async getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).where(eq(timeEntries.projectId, projectId));
  }

  async getTimeEntriesByPersonnel(personnelId: number): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).where(eq(timeEntries.personnelId, personnelId));
  }

  async getTimeEntries(): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries);
  }

  async getTimeEntriesByClient(clientId: number): Promise<TimeEntry[]> {
    const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, clientId));
    const clientQuotationIds = clientQuotations.map(q => q.id);

    const projects = await db.select().from(activeProjects).where(inArray(activeProjects.quotationId, clientQuotationIds));
    const projectIds = projects.map(p => p.id);

    if (projectIds.length === 0) return [];
    return await db.select().from(timeEntries).where(inArray(timeEntries.projectId, projectIds));
  }

  async getTimeEntryById(id: number): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry;
  }

  async updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [updatedEntry] = await db
      .update(timeEntries)
      .set(entry)
      .where(eq(timeEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteTimeEntry(id: number): Promise<boolean> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
    const entry = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry.length === 0;
  }

  async approveTimeEntry(id: number, approverId: number): Promise<TimeEntry | undefined> {
    const [updatedEntry] = await db
      .update(timeEntries)
      .set({
        approved: true,
        approvedBy: approverId,
        approvedDate: new Date()
      })
      .where(eq(timeEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteTimeEntriesByProject(projectId: number): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.projectId, projectId));
  }

  // Progress report operations
  async getProgressReports(projectId: number): Promise<ProgressReport[]> {
    return await db.select().from(progressReports).where(eq(progressReports.projectId, projectId));
  }

  async createProgressReport(report: InsertProgressReport): Promise<ProgressReport> {
    const [newReport] = await db.insert(progressReports).values(report).returning();
    return newReport;
  }

  async updateProgressReport(id: number, report: Partial<InsertProgressReport>): Promise<ProgressReport | undefined> {
    const [updatedReport] = await db
      .update(progressReports)
      .set(report)
      .where(eq(progressReports.id, id))
      .returning();
    return updatedReport;
  }

  async deleteProgressReport(id: number): Promise<boolean> {
    await db.delete(progressReports).where(eq(progressReports.id, id));
    const report = await db.select().from(progressReports).where(eq(progressReports.id, id));
    return report.length === 0;
  }

  // Chat operations
  async getConversations(): Promise<any[]> {
    return await db.select().from(chatConversations);
  }

  async createConversation(conversation: any): Promise<any> {
    const [newConversation] = await db.insert(chatConversations).values(conversation).returning();
    return newConversation;
  }

  async getMessages(conversationId: number): Promise<any[]> {
    return await db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId));
  }

  async createMessage(message: any): Promise<any> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async addParticipantToConversation(conversationId: number, userId: number): Promise<boolean> {
    const [participant] = await db.insert(chatConversationParticipants).values({
      conversationId,
      userId
    }).returning();

    return participant.id > 0;
  }

  async updateConversationLastActivity(conversationId: number): Promise<void> {
    await db
      .update(chatConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));
  }

  async markConversationMessagesAsSeen(conversationId: number, userId: number): Promise<void> {
    await db
      .update(chatMessages)
      .set({ seen: true })
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          sql`${chatMessages.senderId} <> ${userId}`
        )
      );
  }

  // Deliverable operations
  async getDeliverablesByProjects(projectIds: number[]): Promise<Deliverable[]> {
    try {
      if (projectIds.length === 0) return [];


      const deliverableList = await db.select().from(deliverables).where(inArray(deliverables.project_id, projectIds));

      return deliverableList;
    } catch (error) {
      console.error("Error al obtener entregables:", error);
      throw error;
    }
  }

  async createDeliverable(deliverable: any): Promise<Deliverable> {
    try {

      const dataToInsert = {
        clientId: deliverable.clientId || deliverable.client_id,
        name: deliverable.name || deliverable.title,
        deliveryMonth: deliverable.deliveryMonth || new Date().toISOString().substring(0, 7),
        deliveryOnTime: deliverable.onTime || deliverable.deliveryOnTime || deliverable.on_time || false,
        narrativeQuality: deliverable.narrativeQuality || deliverable.narrative_quality || "0",
        graphicsEffectiveness: deliverable.graphicsEffectiveness || deliverable.graphics_effectiveness || "0",
        formatDesign: deliverable.formatDesign || deliverable.format_design || "0",
        relevantInsights: deliverable.relevantInsights || deliverable.relevant_insights || "0",
        operationsFeedback: deliverable.operationsFeedback || deliverable.operations_feedback || "0",
        clientFeedback: deliverable.clientFeedback || deliverable.client_feedback || "0",
        briefCompliance: deliverable.briefCompliance || deliverable.brief_compliance || "0",
        project_id: deliverable.projectId || deliverable.project_id,
        delivery_date: deliverable.deliveryDate || new Date(),
        due_date: deliverable.dueDate || deliverable.due_date || new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };


      const [newDeliverable] = await db.insert(deliverables).values([dataToInsert]).returning();
      return newDeliverable;
    } catch (error) {
      console.error("Error al crear entregable:", error);
      throw error;
    }
  }

  async updateDeliverable(id: number, data: any): Promise<Deliverable | undefined> {
    try {

      const updateData: any = { updatedAt: new Date() };

      // Mapear campos correctamente
      if (data.name !== undefined) updateData.name = data.name;
      if (data.title !== undefined) updateData.name = data.title;
      if (data.projectId !== undefined) updateData.projectId = data.projectId;
      if (data.project_id !== undefined) updateData.projectId = data.project_id;
      if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate;
      if (data.delivery_date !== undefined) updateData.deliveryDate = data.delivery_date;
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
      if (data.due_date !== undefined) updateData.dueDate = data.due_date;
      if (data.onTime !== undefined) updateData.onTime = data.onTime;
      if (data.deliveryOnTime !== undefined) updateData.onTime = data.deliveryOnTime;
      if (data.on_time !== undefined) updateData.onTime = data.on_time;

      // Mapear campos de calidad (frontend "_score" -> backend sin sufijo)
      if (data.narrative_quality_score !== undefined) updateData.narrativeQuality = data.narrative_quality_score;
      if (data.narrative_quality !== undefined) updateData.narrativeQuality = data.narrative_quality;
      if (data.graphics_effectiveness_score !== undefined) updateData.graphicsEffectiveness = data.graphics_effectiveness_score;
      if (data.graphics_effectiveness !== undefined) updateData.graphicsEffectiveness = data.graphics_effectiveness;
      if (data.format_design_score !== undefined) updateData.formatDesign = data.format_design_score;
      if (data.format_design !== undefined) updateData.formatDesign = data.format_design;
      if (data.relevant_insights_score !== undefined) updateData.relevantInsights = data.relevant_insights_score;
      if (data.relevant_insights !== undefined) updateData.relevantInsights = data.relevant_insights;
      if (data.operations_feedback_score !== undefined) updateData.operationsFeedback = data.operations_feedback_score;
      if (data.operations_feedback !== undefined) updateData.operationsFeedback = data.operations_feedback;
      if (data.client_feedback_score !== undefined) updateData.clientFeedback = data.client_feedback_score;
      if (data.client_feedback !== undefined) updateData.clientFeedback = data.client_feedback;
      if (data.brief_compliance_score !== undefined) updateData.briefCompliance = data.brief_compliance_score;
      if (data.brief_compliance !== undefined) updateData.briefCompliance = data.brief_compliance;
      if (data.notes !== undefined) updateData.notes = data.notes;


      const [updatedDeliverable] = await db
        .update(deliverables)
        .set(updateData)
        .where(eq(deliverables.id, id))
        .returning();

      if (!updatedDeliverable) {
        return undefined;
      }

      return updatedDeliverable;
    } catch (error) {
      console.error(`Error al actualizar entregable ID ${id}:`, error);
      throw error;
    }
  }

  async deleteDeliverablesByProject(projectId: number): Promise<void> {
    await db.delete(deliverables).where(eq(deliverables.project_id, projectId));
  }

  // Client MODO operations
  async getClientStatistics(clientId: number): Promise<{
    totalDeliverables: number;
    onTimeDeliveries: number;
    deliveryRate: number;
    qualityScores: {
      narrativeQuality: number;
      graphicsEffectiveness: number;
      formatDesign: number;
      relevantInsights: number;
      operationsFeedback: number;
      clientFeedback: number;
      briefCompliance: number;
    };
    totalComments: number;
    latestComment?: ClientModoComment;
  }> {
    try {

      // Obtener proyectos del cliente
      const clientProjects = await this.getActiveProjectsByClient(clientId);
      const projectIds = clientProjects.map(p => p.id);


      // Obtener entregables
      const deliverablesList = await this.getDeliverablesByProjects(projectIds);


      // Calcular estadísticas
      const totalDeliverables = deliverablesList.length;
      const onTimeDeliveries = deliverablesList.filter(d => d.deliveryOnTime).length;
      const deliveryRate = totalDeliverables > 0 ? (onTimeDeliveries / totalDeliverables) * 100 : 0;

      // Calcular promedios de calidad
      let sumNarrativeQuality = 0, countNarrativeQuality = 0;
      let sumGraphicsEffectiveness = 0, countGraphicsEffectiveness = 0;
      let sumFormatDesign = 0, countFormatDesign = 0;
      let sumRelevantInsights = 0, countRelevantInsights = 0;
      let sumOperationsFeedback = 0, countOperationsFeedback = 0;
      let sumClientFeedback = 0, countClientFeedback = 0;
      let sumBriefCompliance = 0, countBriefCompliance = 0;

      deliverablesList.forEach(d => {
        if (d.narrativeQuality != null) { sumNarrativeQuality += parseFloat(String(d.narrativeQuality)); countNarrativeQuality++; }
        if (d.graphicsEffectiveness != null) { sumGraphicsEffectiveness += parseFloat(String(d.graphicsEffectiveness)); countGraphicsEffectiveness++; }
        if (d.formatDesign != null) { sumFormatDesign += parseFloat(String(d.formatDesign)); countFormatDesign++; }
        if (d.relevantInsights != null) { sumRelevantInsights += parseFloat(String(d.relevantInsights)); countRelevantInsights++; }
        if (d.operationsFeedback != null) { sumOperationsFeedback += parseFloat(String(d.operationsFeedback)); countOperationsFeedback++; }
        if (d.clientFeedback != null) { sumClientFeedback += parseFloat(String(d.clientFeedback)); countClientFeedback++; }
        if (d.briefCompliance != null) { sumBriefCompliance += parseFloat(String(d.briefCompliance)); countBriefCompliance++; }
      });

      const averageNarrativeQuality = countNarrativeQuality > 0 ? sumNarrativeQuality / countNarrativeQuality : 0;
      const averageGraphicsEffectiveness = countGraphicsEffectiveness > 0 ? sumGraphicsEffectiveness / countGraphicsEffectiveness : 0;
      const averageFormatDesign = countFormatDesign > 0 ? sumFormatDesign / countFormatDesign : 0;
      const averageRelevantInsights = countRelevantInsights > 0 ? sumRelevantInsights / countRelevantInsights : 0;
      const averageOperationsFeedback = countOperationsFeedback > 0 ? sumOperationsFeedback / countOperationsFeedback : 0;
      const averageClientFeedback = countClientFeedback > 0 ? sumClientFeedback / countClientFeedback : 0;
      const averageBriefCompliance = countBriefCompliance > 0 ? sumBriefCompliance / countBriefCompliance : 0;

      // Obtener comentarios MODO
      const comments = await db
        .select()
        .from(clientModoComments)
        .where(eq(clientModoComments.clientId, clientId))
        .orderBy(desc(clientModoComments.year));


      const totalComments = comments.length;
      const latestComment = comments.length > 0 ? comments[0] : undefined;

      return {
        totalDeliverables,
        onTimeDeliveries,
        deliveryRate: Number(deliveryRate.toFixed(2)),
        qualityScores: {
          narrativeQuality: Number(averageNarrativeQuality.toFixed(2)),
          graphicsEffectiveness: Number(averageGraphicsEffectiveness.toFixed(2)),
          formatDesign: Number(averageFormatDesign.toFixed(2)),
          relevantInsights: Number(averageRelevantInsights.toFixed(2)),
          operationsFeedback: Number(averageOperationsFeedback.toFixed(2)),
          clientFeedback: Number(averageClientFeedback.toFixed(2)),
          briefCompliance: Number(averageBriefCompliance.toFixed(2)),
        },
        totalComments,
        latestComment
      };
    } catch (error) {
      console.error("Error al obtener estadísticas del cliente:", error);
      throw error;
    }
  }

  async getClientModoComments(clientId: number): Promise<ClientModoComment[]> {
    try {
      const comments = await db
        .select()
        .from(clientModoComments)
        .where(eq(clientModoComments.clientId, clientId))
        .orderBy(desc(clientModoComments.year));

      return comments;
    } catch (error) {
      console.error("Error al obtener comentarios MODO:", error);
      throw error;
    }
  }

  async createClientModoComment(comment: any): Promise<ClientModoComment> {
    try {

      const dataToInsert = {
        clientId: comment.clientId || comment.client_id,
        comments: comment.comments || comment.comment_text,
        year: comment.year,
        quarter: comment.quarter,
        totalScore: comment.totalScore || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const [newComment] = await db.insert(clientModoComments).values([dataToInsert]).returning();

      return newComment;
    } catch (error) {
      console.error("Error al crear comentario MODO:", error);
      throw error;
    }
  }

  // NPS Survey operations
  async getAllNpsSurveys(): Promise<QuarterlyNpsSurvey[]> {
    try {
      const surveys = await db.select().from(quarterlyNpsSurveys).orderBy(desc(quarterlyNpsSurveys.createdAt));
      return surveys;
    } catch (error) {
      console.error('Error al obtener todas las encuestas NPS:', error);
      return [];
    }
  }

  async getNpsSurveysByClient(clientId: number): Promise<QuarterlyNpsSurvey[]> {
    try {
      const surveys = await db.select().from(quarterlyNpsSurveys).where(eq(quarterlyNpsSurveys.clientId, clientId));
      return surveys;
    } catch (error) {
      console.error(`Error al obtener encuestas NPS del cliente ${clientId}:`, error);
      return [];
    }
  }

  async getNpsSurvey(id: number): Promise<QuarterlyNpsSurvey | undefined> {
    try {
      const [survey] = await db.select().from(quarterlyNpsSurveys).where(eq(quarterlyNpsSurveys.id, id));
      return survey;
    } catch (error) {
      console.error(`Error al obtener encuesta NPS ${id}:`, error);
      return undefined;
    }
  }

  async createNpsSurvey(survey: InsertQuarterlyNpsSurvey): Promise<QuarterlyNpsSurvey> {
    try {
      const [newSurvey] = await db.insert(quarterlyNpsSurveys).values(survey).returning();
      return newSurvey;
    } catch (error) {
      console.error(`Error al crear encuesta NPS:`, error);
      throw error;
    }
  }

  async updateNpsSurvey(id: number, survey: Partial<InsertQuarterlyNpsSurvey>): Promise<QuarterlyNpsSurvey | undefined> {
    try {
      const [updatedSurvey] = await db.update(quarterlyNpsSurveys)
        .set(survey)
        .where(eq(quarterlyNpsSurveys.id, id))
        .returning();
      return updatedSurvey;
    } catch (error) {
      console.error(`Error al actualizar encuesta NPS ${id}:`, error);
      return undefined;
    }
  }

  async deleteNpsSurvey(id: number): Promise<boolean> {
    try {
      await db.delete(quarterlyNpsSurveys).where(eq(quarterlyNpsSurveys.id, id));
      return true;
    } catch (error) {
      console.error(`Error al eliminar encuesta NPS ${id}:`, error);
      return false;
    }
  }

  // ==================== RECURRING TEMPLATES WITH TEAM ASSIGNMENT ====================

  async createRecurringTemplateWithTeam(template: any): Promise<any> {
    try {
      const [newTemplate] = await db.insert(recurringProjectTemplates).values({
        parentProjectId: template.parentProjectId,
        templateName: template.templateName,
        deliverableType: template.deliverableType,
        frequency: template.frequency,
        dayOfMonth: template.dayOfMonth || undefined,
        dayOfWeek: template.dayOfWeek || undefined,
        estimatedHours: template.estimatedHours || undefined,
        baseBudget: template.baseBudget || undefined,
        description: template.description || undefined,
        autoCreateDaysInAdvance: template.autoCreateDaysInAdvance,
        createdBy: template.createdBy
      }).returning();

      // If team members are provided, create the assignments
      if (template.teamMembers && template.teamMembers.length > 0) {
        const teamAssignments = template.teamMembers.map((member: any) => ({
          templateId: newTemplate.id,
          personnelId: member.personnelId,
          estimatedHours: member.estimatedHours,
          isRequired: member.isRequired
        }));

        await db.insert(recurringTemplatePersonnel).values(teamAssignments);
      }

      // Invalidate cache for this project
      this.templateCache.delete(template.parentProjectId);

      return newTemplate;
    } catch (error) {
      console.error('Error creating recurring template:', error);
      throw error;
    }
  }

  // Simple cache for recurring templates
  private templateCache = new Map<number, { data: any[], timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getRecurringTemplatesWithTeam(projectId: number): Promise<any[]> {
    try {
      // Check cache first
      const cached = this.templateCache.get(projectId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // Fast query - just get basic templates without joins
      const templates = await db.select()
        .from(recurringProjectTemplates)
        .where(eq(recurringProjectTemplates.parentProjectId, projectId))
        .orderBy(desc(recurringProjectTemplates.createdAt));

      if (templates.length === 0) {
        this.templateCache.set(projectId, { data: [], timestamp: Date.now() });
        return [];
      }

      // Only fetch team data if templates exist
      const templateIds = templates.map(t => t.id);
      const teamMembers = await db.select({
        id: recurringTemplatePersonnel.id,
        templateId: recurringTemplatePersonnel.templateId,
        personnelName: personnel.name,
        roleName: roles.name,
        hourlyRate: personnel.hourlyRate,
        estimatedHours: recurringTemplatePersonnel.estimatedHours,
        isRequired: recurringTemplatePersonnel.isRequired
      })
      .from(recurringTemplatePersonnel)
      .innerJoin(personnel, eq(recurringTemplatePersonnel.personnelId, personnel.id))
      .innerJoin(roles, eq(personnel.roleId, roles.id))
      .where(inArray(recurringTemplatePersonnel.templateId, templateIds));

      // Group team members by template
      const teamByTemplate: Record<number, any[]> = {};
      teamMembers.forEach(member => {
        if (!teamByTemplate[member.templateId]) {
          teamByTemplate[member.templateId] = [];
        }
        teamByTemplate[member.templateId].push({
          ...member,
          totalCost: (member.estimatedHours || 0) * (member.hourlyRate || 50)
        });
      });

      const result = templates.map(template => {
        const teamMembersForTemplate = teamByTemplate[template.id] || [];
        return {
          ...template,
          teamMembers: teamMembersForTemplate,
          totalEstimatedCost: teamMembersForTemplate.reduce((sum: number, member: any) => 
            sum + member.totalCost, 0)
        };
      });

      // Cache the result
      this.templateCache.set(projectId, { data: result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error('Error fetching recurring templates:', error);
      return [];
    }
  }

  async updateRecurringTemplateWithTeam(id: number, template: any): Promise<any> {
    try {
      const [updated] = await db.update(recurringProjectTemplates)
        .set({
          templateName: template.templateName,
          deliverableType: template.deliverableType,
          frequency: template.frequency,
          dayOfMonth: template.dayOfMonth || undefined,
          dayOfWeek: template.dayOfWeek || undefined,
          estimatedHours: template.estimatedHours || undefined,
          baseBudget: template.baseBudget || undefined,
          description: template.description || undefined,
          autoCreateDaysInAdvance: template.autoCreateDaysInAdvance,
          isActive: template.isActive
        })
        .where(eq(recurringProjectTemplates.id, id))
        .returning();

      // Invalidate cache for this project
      if (updated) {
        this.templateCache.delete(updated.parentProjectId);
      }

      return updated;
    } catch (error) {
      console.error('Error updating recurring template:', error);
      throw error;
    }
  }

  async deleteRecurringTemplateWithTeam(id: number): Promise<boolean> {
    try {
      // Get the template first to know which project to invalidate cache for
      const [templateToDelete] = await db.select({ parentProjectId: recurringProjectTemplates.parentProjectId })
        .from(recurringProjectTemplates)
        .where(eq(recurringProjectTemplates.id, id));

      // First delete team assignments
      await db.delete(recurringTemplatePersonnel).where(eq(recurringTemplatePersonnel.templateId, id));

      // Then delete the template
      await db.delete(recurringProjectTemplates).where(eq(recurringProjectTemplates.id, id));

      // Invalidate cache for this project
      if (templateToDelete) {
        this.templateCache.delete(templateToDelete.parentProjectId);
      }

      return true;
    } catch (error) {
      console.error('Error deleting recurring template:', error);
      return false;
    }
  }

  // Métodos faltantes para corregir errores de TypeScript
  async getActiveProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]> {
    try {
      return await db.select().from(activeProjects).where(eq(activeProjects.quotationId, quotationId));
    } catch (error) {
      console.error("Error al obtener proyectos activos por cotización:", error);
      return [];
    }
  }

  // Obtener subproyectos por ID del proyecto padre
  async getSubprojectsByParentId(parentId: number): Promise<ActiveProject[]> {
    try {
      return await db.select().from(activeProjects).where(eq(activeProjects.parentProjectId, parentId));
    } catch (error) {
      console.error("Error al obtener subproyectos por proyecto padre:", error);
      return [];
    }
  }



  async getProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]> {
    try {
      return await db.select().from(activeProjects).where(eq(activeProjects.quotationId, quotationId));
    } catch (error) {
      console.error("Error al obtener proyectos por cotización:", error);
      throw error;
    }
  }

  async getClientCostSummary(clientId: number): Promise<any> {
    try {
      const projects = await db.select().from(activeProjects).where(eq(activeProjects.clientId, clientId));
      const allTimeEntries = await db.select().from(timeEntries);

      let totalCost = 0;
      let totalBudget = 0;

      for (const project of projects) {
        totalBudget += parseFloat(String(project.deliverableBudget || 0));
        const projectTimeEntries = allTimeEntries.filter((te: any) => te.projectId === project.id);
        for (const entry of projectTimeEntries) {
          totalCost += parseFloat(String(entry.billable ? entry.hours * 100 : 0));
        }
      }

      return {
        totalCost,
        totalBudget,
        variance: totalBudget - totalCost,
        percentageUsed: totalBudget > 0 ? (totalCost / totalBudget) * 100 : 0
      };
    } catch (error) {
      console.error("Error al obtener resumen de costos del cliente:", error);
      throw error;
    }
  }



  async getProjectComponent(id: number): Promise<any> {
    try {
      const [component] = await db.select().from(projectComponents).where(eq(projectComponents.id, id));
      return component;
    } catch (error) {
      console.error("Error al obtener componente de proyecto:", error);
      throw error;
    }
  }

  async getDefaultProjectComponent(): Promise<any> {
    try {
      const [component] = await db.select().from(projectComponents).limit(1);
      return component;
    } catch (error) {
      console.error("Error al obtener componente por defecto:", error);
      throw error;
    }
  }

  async getProgressReportsByProject(projectId: number): Promise<any[]> {
    try {
      return await db.select().from(progressReports).where(eq(progressReports.projectId, projectId));
    } catch (error) {
      console.error("Error al obtener reportes de progreso:", error);
      throw error;
    }
  }

  async getProgressReport(id: number): Promise<any> {
    try {
      const [report] = await db.select().from(progressReports).where(eq(progressReports.id, id));
      return report;
    } catch (error) {
      console.error("Error al obtener reporte de progreso:", error);
      throw error;
    }
  }

  // Función auxiliar para convertir nombres de mes a números
  private getMonthNumber(monthName: string): string {
    const monthMap: { [key: string]: string } = {
      'enero': '01', 'ene': '01', '01 ene': '01',
      'febrero': '02', 'feb': '02', '02 feb': '02', 
      'marzo': '03', 'mar': '03', '03 mar': '03',
      'abril': '04', 'abr': '04', '04 abr': '04',
      'mayo': '05', 'may': '05', '05 may': '05',
      'junio': '06', 'jun': '06', '06 jun': '06',
      'julio': '07', 'jul': '07', '07 jul': '07',
      'agosto': '08', 'ago': '08', '08 ago': '08',
      'septiembre': '09', 'sep': '09', '09 sep': '09',
      'octubre': '10', 'oct': '10', '10 oct': '10',
      'noviembre': '11', 'nov': '11', '11 nov': '11',
      'diciembre': '12', 'dic': '12', '12 dic': '12'
    };
    
    return monthMap[monthName.toLowerCase()] || '01';
  }

  // ==================== NUEVA FUNCIÓN: OBTENER RANGO DE ACTIVIDAD REAL DE PROYECTOS ONE-SHOT ====================
  // (Removed duplicate function - using implementation at line 4712)

  async getProjectCostSummary(projectId: number, dateRangeOrFilter?: { startDate: Date; endDate: Date } | string): Promise<any> {
    try {
      console.log(`🔍 getProjectCostSummary called with projectId: ${projectId}, filter:`, dateRangeOrFilter);
      const project = await this.getActiveProject(projectId);
      if (!project) return null;

      // NORMALIZE INPUT: Aceptar tanto string como objeto
      const input = dateRangeOrFilter;
      let dateRange: { startDate: Date; endDate: Date } | undefined;
      if (typeof input === 'string') {
        dateRange = getDateRangeForFilter(input) || undefined;
      } else {
        dateRange = input;
      }

      // Obtener ALL time entries para el proyecto
      let entries = await db.select().from(timeEntries).where(eq(timeEntries.projectId, projectId));
      
      // Aplicar filtro temporal a time entries si está especificado
      if (dateRange) {
        entries = entries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= dateRange.startDate && entryDate <= dateRange.endDate;
        });
        // DEFENSIVE LOGGING: Guard para evitar errores
        const startIso = dateRange.startDate?.toISOString?.() ?? 'unknown';
        const endIso = dateRange.endDate?.toISOString?.() ?? 'unknown';
        console.log(`📊 Filtered time entries for cost summary: ${entries.length} entries in range ${startIso} to ${endIso}`);
      }
      
      // NUEVA INTEGRACIÓN: Obtener costos directos del Excel MAESTRO con filtros temporales
      let excelDirectCosts = await this.getDirectCostsByProject(projectId);
      
      // Aplicar filtro temporal a costos directos si está especificado
      if (dateRange) {
        excelDirectCosts = excelDirectCosts.filter(cost => {
          // Manejar diferentes formatos de mes en el Excel MAESTRO
          let monthNumber;
          if (cost.mes.includes(' ')) {
            // Formato "08 ago", "05 may", etc.
            monthNumber = parseInt(cost.mes.substring(0, 2));
          } else {
            // Formato "Agosto", "Mayo", etc.
            monthNumber = this.getMonthNumber(cost.mes);
          }
          const costDate = new Date(`${cost.año}-${monthNumber}-15`); // Día 15 del mes
          const isInRange = costDate >= dateRange.startDate && costDate <= dateRange.endDate;
          if (projectId === 39) {
            console.log(`🔍 Excel cost filter: ${cost.persona} ${cost.mes} ${cost.año} -> Month ${monthNumber} -> ${costDate.toISOString()} -> In range: ${isInRange}`);
          }
          return isInRange;
        });
        console.log(`📊 Filtered Excel direct costs for cost summary: ${excelDirectCosts.length} costs in range`);
      }
      
      console.log(`💰 Direct costs from Excel MAESTRO for project ${projectId}: ${excelDirectCosts.length} records (filtered: ${dateRange ? 'YES' : 'NO'})`);
      
      // Obtener personal involucrado en el proyecto (timeEntries + directCosts)
      const timeEntryPersonnelIds = Array.from(new Set(entries.map(e => e.personnelId)));
      const directCostPersonnelIds = Array.from(new Set(excelDirectCosts.map(dc => dc.personnelId).filter(id => id !== null)));
      const allPersonnelIds = Array.from(new Set([...timeEntryPersonnelIds, ...directCostPersonnelIds]));
      const allPersonnel = allPersonnelIds.length > 0 ? 
        await db.select().from(personnel).where(inArray(personnel.id, allPersonnelIds)) : [];

      let totalRealCost = 0;
      let operationalCost = 0;
      let directCostsFromExcel = 0;
      
      // Calcular costos reales por persona y mes
      const costByPersonMonth = new Map<string, number>();
      const operationalByPersonMonth = new Map<string, number>();

      // PASO 1: Procesar costos directos del Excel MAESTRO como time entries sintéticos
      const syntheticTimeEntries = [];
      for (const directCost of excelDirectCosts) {
        // 🎯 CORRECIÓN CRÍTICA: Usar SIEMPRE montoTotalUSD del Excel MAESTRO
        // No usar valorHoraPersona × horas que puede estar corrupto
        const montoUSD = Number(directCost.montoTotalUSD) || 0; // Convertir a número
        
        if (montoUSD > 0) {
          directCostsFromExcel += montoUSD;
          
          console.log(`💰 Excel MAESTRO cost: ${directCost.persona} - ${directCost.mes} ${directCost.año} = $${montoUSD} USD`);
          
          // Crear time entry sintético para integrar con el sistema existente
          let monthNumber;
          if (directCost.mes.includes(' ')) {
            // Formato "08 ago", "05 may", etc.
            monthNumber = parseInt(directCost.mes.substring(0, 2));
          } else {
            // Formato "Agosto", "Mayo", etc.
            monthNumber = this.getMonthNumber(directCost.mes);
          }
          
          const horasReales = Number(directCost.horasRealesAsana) || 1; // Convertir a número
          
          const syntheticEntry = {
            id: `excel-${directCost.id}`,
            projectId: projectId,
            personnelId: directCost.personnelId || null,
            hours: horasReales, // Fallback para división
            date: new Date(`${directCost.año}-${monthNumber}-15`), // Día 15 del mes
            billable: true,
            description: `Excel MAESTRO: ${directCost.persona} - ${directCost.mes} ${directCost.año}`,
            // 🎯 NO usar valorHoraPersona corrupto, calcular tasa real basada en montoTotalUSD
            hourlyRateAtTime: montoUSD / horasReales,
            costInUSD: montoUSD, // FUENTE ÚNICA DE VERDAD
            isFromExcel: true // Marcador para distinguir
          };
          
          syntheticTimeEntries.push(syntheticEntry);
          
          // Mapear por persona y mes para consolidación (usando nombre ya que personnelId puede ser null)
          const year = directCost.año;
          const monthName = directCost.mes;
          const personKey = `excel-${directCost.persona}-${year}-${monthName}`;
          
          // 🎯 USAR SIEMPRE montoTotalUSD
          costByPersonMonth.set(personKey, (costByPersonMonth.get(personKey) || 0) + montoUSD);
          operationalByPersonMonth.set(personKey, (operationalByPersonMonth.get(personKey) || 0) + montoUSD);
        }
      }

      console.log(`💰 Direct costs calculation for project ${projectId}: { 
        directCostsFromExcel: ${directCostsFromExcel}, 
        directCostsCount: ${excelDirectCosts.length},
        syntheticTimeEntries: ${syntheticTimeEntries.length}
      }`);

      // PASO 2: Combinar time entries reales con los sintéticos del Excel MAESTRO
      const allEntries = [...entries, ...syntheticTimeEntries];
      
      for (const entry of allEntries) {
        if (!entry.billable) continue;

        // Manejar entries sintéticos del Excel MAESTRO
        if ((entry as any).isFromExcel) {
          // Para entries del Excel, ya tenemos el costo calculado en USD
          const costInUSD = (entry as any).costInUSD || 0;
          // Los entries sintéticos ya fueron procesados en el PASO 1, solo saltamos para evitar duplicación
          continue;
        }

        // Procesar time entries tradicionales
        const person = allPersonnel.find(p => p.id === entry.personnelId);
        if (!person || !person.includeInRealCosts) continue;

        const entryDate = new Date(entry.date);
        const year = entryDate.getFullYear();
        const month = entryDate.getMonth(); // 0-based (0 = enero)
        const personMonthKey = `${person.id}-${year}-${month}`;

        // Calcular costo operacional (siempre horas × tarifa registrada)
        const operationalEntryCoste = entry.hours * (entry.hourlyRateAtTime || person.hourlyRate);
        operationalByPersonMonth.set(personMonthKey, 
          (operationalByPersonMonth.get(personMonthKey) || 0) + operationalEntryCoste);

        // Solo contar una vez por persona por mes para costos reales
        if (!costByPersonMonth.has(personMonthKey)) {
          let realMonthlyCost = 0;

          if (person.contractType === 'full-time') {
            // Para full-time: usar sueldo fijo mensual histórico
            const monthField = getHistoricalMonthField(year, month, 'salary');
            realMonthlyCost = person[monthField as keyof Personnel] as number || person.monthlyFixedSalary || 0;
          } else {
            // Para freelance/part-time: usar horas trabajadas × tarifa histórica de ese mes
            const monthField = getHistoricalMonthField(year, month, 'hourly');
            const historicalRate = person[monthField as keyof Personnel] as number || person.hourlyRate;
            
            // Sumar todas las horas de esa persona en ese mes (solo time entries tradicionales)
            const monthlyHours = entries
              .filter(e => {
                const eDate = new Date(e.date);
                return e.personnelId === person.id && 
                       e.billable && 
                       eDate.getFullYear() === year && 
                       eDate.getMonth() === month;
              })
              .reduce((sum, e) => sum + e.hours, 0);
            
            realMonthlyCost = monthlyHours * historicalRate;
          }

          costByPersonMonth.set(personMonthKey, realMonthlyCost);
        }
      }

      // CONSOLIDACIÓN FINAL: Sumar todos los costos (time entries + Excel MAESTRO)
      totalRealCost = Array.from(costByPersonMonth.values()).reduce((sum, cost) => sum + cost, 0);
      operationalCost = Array.from(operationalByPersonMonth.values()).reduce((sum, cost) => sum + cost, 0);
      
      console.log(`💰 Direct costs calculation for project ${projectId}: {
        timeEntriesCost: ${totalRealCost - directCostsFromExcel},
        directCostsFromExcel: ${directCostsFromExcel},
        totalCombinedCost: ${totalRealCost},
        directCostsCount: ${excelDirectCosts.length},
        usingUSDConversion: true
      }`);

      const budget = parseFloat(String(project.deliverableBudget || 0));

      // Crear resumen por persona (incluye personal del Excel MAESTRO)
      const costByPerson = allPersonnel
        .filter(person => person.includeInRealCosts)
        .map(person => {
          const personRealCost = Array.from(costByPersonMonth.entries())
            .filter(([key]) => key.startsWith(`${person.id}-`) || key.includes(person.name))
            .reduce((sum, [, cost]) => sum + cost, 0);
            
          const personOperationalCost = Array.from(operationalByPersonMonth.entries())
            .filter(([key]) => key.startsWith(`${person.id}-`) || key.includes(person.name))
            .reduce((sum, [, cost]) => sum + cost, 0);

          // Calcular horas trabajadas para esta persona (time entries + Excel MAESTRO)
          const personHours = allEntries
            .filter(entry => {
              if ((entry as any).isFromExcel) {
                // Para entries del Excel, buscar por nombre de persona
                return (entry as any).description?.includes(person.name);
              } else {
                // Para time entries tradicionales, buscar por personnelId
                return entry.personnelId === person.id;
              }
            })
            .reduce((sum, entry) => sum + (entry.hours || 0), 0);

          // Calcular horas objetivo para esta persona del Excel MAESTRO
          const personTargetHours = excelDirectCosts
            .filter(cost => cost.persona === person.name)
            .reduce((sum, cost) => sum + (cost.horasObjetivo || 0), 0);

          return {
            personnelId: person.id,
            name: person.name,
            contractType: person.contractType,
            realCost: personRealCost,
            operationalCost: personOperationalCost,
            hours: personHours,
            targetHours: personTargetHours // NUEVO: Horas objetivo del Excel MAESTRO
          };
        })
        .filter(person => person.realCost > 0 || person.operationalCost > 0 || person.hours > 0);

      if (projectId === 39) {
        console.log(`🔍 DEBUG costByPerson for project 39 (traditional personnel):`, costByPerson.map(p => ({ name: p.name, hours: p.hours, realCost: p.realCost })));
      }

      // CORRECCIÓN CRÍTICA: Forzar inclusión de datos del Excel MAESTRO para proyectos filtrados
      const excelOnlyPersonnel = excelDirectCosts
        .reduce((acc, cost) => {
          // Buscar si ya existe una entrada para esta persona
          const existing = acc.find(p => p.name === cost.persona);
          if (existing) {
            existing.realCost += cost.montoTotalUSD || 0;
            existing.operationalCost += cost.montoTotalUSD || 0;
            existing.hours += cost.horasRealesAsana || 0;
            existing.targetHours += cost.horasObjetivo || 0; // NUEVO: Agregar horas objetivo
          } else {
            acc.push({
              personnelId: null,
              name: cost.persona,
              contractType: 'external',
              realCost: cost.montoTotalUSD || 0,
              operationalCost: cost.montoTotalUSD || 0,
              hours: cost.horasRealesAsana || 0,
              targetHours: cost.horasObjetivo || 0, // NUEVO: Horas objetivo del Excel MAESTRO
              isFromExcel: true
            });
          }
          return acc;
        }, [] as any[]);
      
      if (projectId === 39 && dateRange) {
        console.log(`🔍 FORCED DEBUG - Excel personnel for project 39:`, excelOnlyPersonnel.map(p => ({ name: p.name, hours: p.hours, realCost: p.realCost })));
      }

      // CORRECCIÓN CRÍTICA: Combinar costByPerson con excelOnlyPersonnel SIN DUPLICADOS
      for (const excelPerson of excelOnlyPersonnel) {
        const existingTraditional = costByPerson.find(p => p.name === excelPerson.name);
        if (existingTraditional) {
          // CORRECCIÓN CRÍTICA: Para rankings, usar SOLO datos del Excel MAESTRO (más exactos)
          console.log(`🔗 Reemplazando datos tradicionales con Excel MAESTRO: ${excelPerson.name}`);
          existingTraditional.realCost = excelPerson.realCost; // USAR SOLO Excel MAESTRO
          existingTraditional.operationalCost = excelPerson.operationalCost; // USAR SOLO Excel MAESTRO
          existingTraditional.hours = excelPerson.hours; // USAR SOLO Excel MAESTRO
          if (excelPerson.targetHours > 0) {
            existingTraditional.targetHours = excelPerson.targetHours; // USAR SOLO Excel MAESTRO
          }
          // Marcar que tiene datos de Excel
          existingTraditional.hasExcelData = true;
        } else {
          // Solo agregar si NO existe en el array tradicional
          costByPerson.push(excelPerson);
        }
      }
      
      console.log(`🔍 DEBUG costByPerson for project ${projectId}:`, {
        traditionalPersonnel: costByPerson.length - excelOnlyPersonnel.length,
        excelOnlyPersonnel: excelOnlyPersonnel.length,
        totalCostByPerson: costByPerson.length,
        excelDirectCostsCount: excelDirectCosts.length,
        allPersonnelCount: allPersonnel.length,
        dateRangeApplied: !!dateRange
      });

      // Calcular horas totales (time entries + Excel MAESTRO)
      const totalWorkedHours = entries.reduce((sum, entry) => sum + entry.hours, 0) + 
                              excelDirectCosts.reduce((sum, dc) => sum + dc.horasRealesAsana, 0);

      console.log(`💰 Proyecto ${projectId} - Real: $${totalRealCost.toFixed(2)} | Operacional: $${operationalCost.toFixed(2)} | Presupuesto: $${budget.toFixed(2)} | Horas: ${totalWorkedHours.toFixed(1)}`);

      return {
        projectId,
        totalCost: totalRealCost, // Costo real para rentabilidad (incluye Excel MAESTRO)
        operationalCost, // Costo operacional para análisis de productividad
        budget,
        variance: budget - totalRealCost,
        percentageUsed: budget ? (totalRealCost / budget) * 100 : 0,
        totalWorkedHours, // NUEVO: Horas totales (time entries + Excel MAESTRO)
        costByPerson, // Desglose por persona
        costBreakdown: {
          realCost: totalRealCost,
          operationalCost: operationalCost,
          directCostsFromExcel: directCostsFromExcel, // NUEVO: Costos del Excel MAESTRO
          timeEntriesCost: totalRealCost - directCostsFromExcel, // NUEVO: Costos de time entries
          timeEntriesHours: entries.reduce((sum, entry) => sum + entry.hours, 0), // NUEVO: Horas de time entries
          excelMaestroHours: excelDirectCosts.reduce((sum, dc) => sum + dc.horasRealesAsana, 0), // NUEVO: Horas del Excel
          personnelCount: allPersonnelIds.length,
          excelDirectCostsCount: excelDirectCosts.length // NUEVO: Cantidad de registros del Excel
        },
        // NUEVO: Datos detallados del Excel MAESTRO para análisis
        excelDirectCosts: excelDirectCosts.map(dc => ({
          persona: dc.persona,
          mes: dc.mes,
          año: dc.año,
          horasRealesAsana: dc.horasRealesAsana,
          montoTotalUSD: dc.montoTotalUSD,
          costoTotal: dc.costoTotal,
          valorHoraPersona: dc.valorHoraPersona
        }))
      };
    } catch (error) {
      console.error("Error al obtener resumen de costos del proyecto:", error);
      throw error;
    }
  }

  async getDeliverables(projectIds: number[]): Promise<Deliverable[]> {
    try {
      if (projectIds.length === 0) return [];
      return await db.select().from(deliverables).where(inArray(deliverables.project_id, projectIds));
    } catch (error) {
      console.error("Error al obtener entregables:", error);
      throw error;
    }
  }

  async getDeliverable(id: number): Promise<Deliverable | undefined> {
    try {
      const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, id));
      return deliverable;
    } catch (error) {
      console.error("Error al obtener entregable:", error);
      throw error;
    }
  }

  async deleteDeliverable(id: number): Promise<boolean> {
    try {
      await db.delete(deliverables).where(eq(deliverables.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar entregable:", error);
      return false;
    }
  }

  async getClientModoComment(clientId: number, quarter: number, year: number): Promise<any> {
    try {
      const [comment] = await db.select().from(clientModoComments)
        .where(and(
          eq(clientModoComments.clientId, clientId),
          eq(clientModoComments.quarter, quarter),
          eq(clientModoComments.year, year)
        ));
      return comment;
    } catch (error) {
      console.error("Error al obtener comentario MODO:", error);
      throw error;
    }
  }

  async getClientModoCommentByQuarter(clientId: number, quarter: number, year: number): Promise<any> {
    try {
      return await this.getClientModoComment(clientId, quarter, year);
    } catch (error) {
      console.error("Error al obtener comentario MODO por trimestre:", error);
      throw error;
    }
  }

  async updateClientModoComment(id: number, comment: any): Promise<any> {
    try {
      const [updatedComment] = await db.update(clientModoComments)
        .set({
          comments: comment.comments,
          updatedAt: new Date()
        })
        .where(eq(clientModoComments.id, id))
        .returning();
      return updatedComment;
    } catch (error) {
      console.error("Error al actualizar comentario MODO:", error);
      throw error;
    }
  }

  async deleteClientModoComment(id: number): Promise<boolean> {
    try {
      await db.delete(clientModoComments).where(eq(clientModoComments.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar comentario MODO:", error);
      return false;
    }
  }

  async getClientModoSummary(clientId: number): Promise<any> {
    try {
      const comments = await db.select().from(clientModoComments)
        .where(eq(clientModoComments.clientId, clientId));

      const projects = await db.select().from(activeProjects)
        .where(eq(activeProjects.clientId, clientId));

      return {
        clientId,
        totalComments: comments.length,
        totalProjects: projects.length,
        recentComments: comments.slice(-5)
      };
    } catch (error) {
      console.error("Error al obtener resumen MODO del cliente:", error);
      throw error;
    }
  }



  // ==================== MULTIPLICADORES DE COSTOS ====================

  async getCostMultipliers(): Promise<CostMultiplier[]> {
    return await db.select().from(costMultipliers).orderBy(costMultipliers.category, costMultipliers.subcategory);
  }

  async getCostMultipliersByCategory(category: string): Promise<CostMultiplier[]> {
    return await db.select().from(costMultipliers)
      .where(and(eq(costMultipliers.category, category), eq(costMultipliers.isActive, true)))
      .orderBy(costMultipliers.subcategory);
  }

  async getCostMultiplier(id: number): Promise<CostMultiplier | undefined> {
    const [multiplier] = await db.select().from(costMultipliers).where(eq(costMultipliers.id, id));
    return multiplier || undefined;
  }

  async updateCostMultiplier(id: number, multiplier: Partial<InsertCostMultiplier>): Promise<CostMultiplier | undefined> {
    try {
      const updateData = {
        ...multiplier,
        updatedAt: new Date(),
      };

      const [updated] = await db.update(costMultipliers)
        .set(updateData)
        .where(eq(costMultipliers.id, id))
        .returning();

      return updated || undefined;
    } catch (error) {
      console.error("Error al actualizar multiplicador de costo:", error);
      return undefined;
    }
  }

  async createCostMultiplier(multiplier: InsertCostMultiplier): Promise<CostMultiplier> {
    const [created] = await db.insert(costMultipliers).values(multiplier).returning();
    return created;
  }

  async deleteCostMultiplier(id: number): Promise<boolean> {
    try {
      await db.delete(costMultipliers).where(eq(costMultipliers.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar multiplicador de costo:", error);
      return false;
    }
  }

  // =============== PLANTILLAS RECURRENTES (LEGACY INTERFACE COMPLIANCE) ===============

  async getRecurringTemplatesByProject(parentProjectId: number): Promise<RecurringProjectTemplate[]> {
    return await db.select()
      .from(recurringProjectTemplates)
      .where(eq(recurringProjectTemplates.parentProjectId, parentProjectId))
      .orderBy(recurringProjectTemplates.templateName);
  }

  async getRecurringTemplate(id: number): Promise<RecurringProjectTemplate | undefined> {
    const [template] = await db.select().from(recurringProjectTemplates)
      .where(eq(recurringProjectTemplates.id, id));
    return template || undefined;
  }

  async createRecurringTemplate(template: InsertRecurringProjectTemplate): Promise<RecurringProjectTemplate> {
    const [created] = await db.insert(recurringProjectTemplates).values(template).returning();
    return created;
  }

  async updateRecurringTemplate(id: number, template: Partial<InsertRecurringProjectTemplate>): Promise<RecurringProjectTemplate | undefined> {
    try {
      const [updated] = await db.update(recurringProjectTemplates)
        .set(template)
        .where(eq(recurringProjectTemplates.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("Error updating recurring template:", error);
      return undefined;
    }
  }

  async deleteRecurringTemplate(id: number): Promise<boolean> {
    try {
      await db.delete(recurringProjectTemplates).where(eq(recurringProjectTemplates.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting recurring template:", error);
      return false;
    }
  }

  // =============== CICLOS DE PROYECTO ===============

  async getProjectCycles(parentProjectId: number): Promise<ProjectCycle[]> {
    return await db.select()
      .from(projectCycles)
      .where(eq(projectCycles.parentProjectId, parentProjectId))
      .orderBy(desc(projectCycles.startDate));
  }

  async getProjectCycle(id: number): Promise<ProjectCycle | undefined> {
    const [cycle] = await db.select().from(projectCycles)
      .where(eq(projectCycles.id, id));
    return cycle || undefined;
  }

  async createProjectCycle(cycle: InsertProjectCycle): Promise<ProjectCycle> {
    const [created] = await db.insert(projectCycles).values(cycle).returning();
    return created;
  }

  async updateProjectCycle(id: number, cycle: Partial<InsertProjectCycle>): Promise<ProjectCycle | undefined> {
    try {
      const [updated] = await db.update(projectCycles)
        .set(cycle)
        .where(eq(projectCycles.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("Error updating project cycle:", error);
      return undefined;
    }
  }

  async completeProjectCycle(id: number): Promise<ProjectCycle | undefined> {
    try {
      // Obtener el ciclo actual
      const cycle = await this.getProjectCycle(id);
      if (!cycle) return undefined;

      // Calcular el costo real basado en horas registradas si hay subproyecto
      let actualCost = 0;
      let budgetVariance = 0;

      if (cycle.subprojectId) {
        const costSummary = await this.getProjectCostSummary(cycle.subprojectId);
        actualCost = costSummary.totalCost;

        // Obtener template para comparar con presupuesto base
        if (cycle.templateId) {
          const template = await this.getRecurringTemplate(cycle.templateId);
          if (template && template.baseBudget) {
            budgetVariance = actualCost - template.baseBudget;
          }
        }
      }

      // Actualizar ciclo como completado
      const [updated] = await db.update(projectCycles)
        .set({
          status: 'completed',
          actualCost,
          budgetVariance,
          completedAt: new Date()
        })
        .where(eq(projectCycles.id, id))
        .returning();

      return updated || undefined;
    } catch (error) {
      console.error("Error completing project cycle:", error);
      return undefined;
    }
  }

  // =============== AUTOMATIZACIÓN ===============

  async autoGenerateSubprojects(
    parentProjectId: number, 
    templateId: number, 
    periodStart: Date, 
    periodEnd: Date
  ): Promise<ActiveProject[]> {
    try {
      const template = await this.getRecurringTemplate(templateId);
      if (!template) throw new Error("Template not found");

      const parentProject = await this.getActiveProject(parentProjectId);
      if (!parentProject) throw new Error("Parent project not found");

      const generatedProjects: ActiveProject[] = [];

      // Generar subproyectos basados en la frecuencia
      let currentDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      while (currentDate <= endDate) {
        const cycleName = this.generateCycleName(template.frequency, currentDate);
        const cycleEnd = this.calculateCycleEnd(template.frequency, currentDate);

        // Crear ciclo de proyecto
        const cycle = await this.createProjectCycle({
          parentProjectId,
          templateId,
          cycleName,
          cycleType: template.frequency,
          startDate: new Date(currentDate),
          endDate: cycleEnd,
          status: 'upcoming'
        });

        // Crear subproyecto basado en la plantilla
        const subprojectData: InsertActiveProject = {
          quotationId: parentProject.quotationId,
          clientId: parentProject.clientId,
          parentProjectId,
          startDate: new Date(currentDate),
          expectedEndDate: cycleEnd,
          status: 'active',
          trackingFrequency: 'weekly',
          subprojectName: cycleName,
          deliverableType: template.deliverableType,
          deliverableFrequency: template.frequency,
          deliverableBudget: template.baseBudget ?? undefined,
          deliverableDescription: template.description ?? undefined,
          completionStatus: 'pending'
        };

        const subproject = await this.createActiveProject(subprojectData);
        generatedProjects.push(subproject);

        // Actualizar ciclo con referencia al subproyecto
        await this.updateProjectCycle(cycle.id, { subprojectId: subproject.id });

        // Avanzar a la siguiente fecha según frecuencia
        currentDate = this.getNextCycleDate(template.frequency, currentDate);
      }

      return generatedProjects;
    } catch (error) {
      console.error("Error auto-generating subprojects:", error);
      throw error;
    }
  }

  async checkAndCreatePendingCycles(): Promise<ProjectCycle[]> {
    try {
      // Obtener todas las plantillas activas
      const templates = await db.select()
        .from(recurringProjectTemplates)
        .where(eq(recurringProjectTemplates.isActive, true));

      const createdCycles: ProjectCycle[] = [];
      const today = new Date();

      for (const template of templates) {
        // Verificar si necesita crear próximo ciclo
        const shouldCreate = await this.shouldCreateNextCycle(template, today);

        if (shouldCreate) {
          const nextCycleStart = this.calculateNextCycleStart(template);
          const nextCycleEnd = this.calculateCycleEnd(template.frequency, nextCycleStart);
          const cycleName = this.generateCycleName(template.frequency, nextCycleStart);

          const cycle = await this.createProjectCycle({
            parentProjectId: template.parentProjectId,
            templateId: template.id,
            cycleName,
            cycleType: template.frequency,
            startDate: nextCycleStart,
            endDate: nextCycleEnd,
            status: 'upcoming'
          });

          createdCycles.push(cycle);
        }
      }

      return createdCycles;
    } catch (error) {
      console.error("Error checking pending cycles:", error);
      throw error;
    }
  }

  // =============== MÉTODOS AUXILIARES PARA AUTOMATIZACIÓN ===============

  private generateCycleName(frequency: string, date: Date): string {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    switch (frequency) {
      case 'monthly':
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      case 'weekly':
        const weekNum = Math.ceil(date.getDate() / 7);
        return `Semana ${weekNum} - ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      case 'biweekly':
        const biweekNum = Math.ceil(date.getDate() / 14);
        return `Quincena ${biweekNum} - ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      default:
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }
  }

  private calculateCycleEnd(frequency: string, startDate: Date): Date {
    const endDate = new Date(startDate);

    switch (frequency) {
      case 'weekly':
        endDate.setDate(endDate.getDate() + 6);
        break;
      case 'biweekly':
        endDate.setDate(endDate.getDate() + 13);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
        break;
    }

    return endDate;
  }

  private getNextCycleDate(frequency: string, currentDate: Date): Date {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }

    return nextDate;
  }

  private async shouldCreateNextCycle(template: RecurringProjectTemplate, today: Date): Promise<boolean> {
    // Obtener el último ciclo para esta plantilla
    const [lastCycle] = await db.select()
      .from(projectCycles)
      .where(eq(projectCycles.templateId, template.id))
      .orderBy(desc(projectCycles.endDate))
      .limit(1);

    if (!lastCycle) return true; // No hay ciclos, crear el primero

    // Verificar si debe crear basado en días de anticipación
    const nextCycleStart = this.calculateNextCycleStart(template);
    const daysUntilNext = Math.ceil((nextCycleStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return daysUntilNext <= (template.autoCreateDaysInAdvance || 7);
  }

  private calculateNextCycleStart(template: RecurringProjectTemplate): Date {
    const today = new Date();
    const nextStart = new Date(today);

    switch (template.frequency) {
      case 'monthly':
        if (template.dayOfMonth) {
          nextStart.setDate(template.dayOfMonth);
          if (nextStart <= today) {
            nextStart.setMonth(nextStart.getMonth() + 1);
          }
        } else {
          nextStart.setMonth(nextStart.getMonth() + 1);
          nextStart.setDate(1);
        }
        break;
      case 'weekly':
        if (template.dayOfWeek !== null && template.dayOfWeek !== undefined) {
          const daysUntilNext = (template.dayOfWeek - today.getDay() + 7) % 7;
          nextStart.setDate(today.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
        } else {
          nextStart.setDate(today.getDate() + 7);
        }
        break;
      default:
        nextStart.setDate(today.getDate() + 7);
    }

    return nextStart;
  }

  // ==================== PROJECT BASE TEAM OPERATIONS ====================
  async getProjectBaseTeam(projectId: number): Promise<ProjectBaseTeam[]> {
    try {
      return await db.select().from(projectBaseTeam).where(eq(projectBaseTeam.projectId, projectId));
    } catch (error) {
      console.error("Error al obtener equipo base del proyecto:", error);
      throw error;
    }
  }

  async createProjectBaseTeam(team: InsertProjectBaseTeam): Promise<ProjectBaseTeam> {
    try {
      const [created] = await db.insert(projectBaseTeam).values(team).returning();
      return created;
    } catch (error) {
      console.error("Error al crear miembro del equipo base:", error);
      throw error;
    }
  }

  async createProjectBaseTeamMember(team: InsertProjectBaseTeam): Promise<ProjectBaseTeam> {
    try {
      const [created] = await db.insert(projectBaseTeam).values(team).returning();
      return created;
    } catch (error) {
      console.error("Error al crear miembro individual del equipo base:", error);
      throw error;
    }
  }

  async updateProjectBaseTeam(id: number, team: Partial<InsertProjectBaseTeam>): Promise<ProjectBaseTeam | undefined> {
    try {
      const [updated] = await db.update(projectBaseTeam).set(team).where(eq(projectBaseTeam.id, id)).returning();
      return updated;
    } catch (error) {
      console.error("Error al actualizar miembro del equipo base:", error);
      throw error;
    }
  }

  async deleteProjectBaseTeam(id: number): Promise<boolean> {
    try {
      await db.delete(projectBaseTeam).where(eq(projectBaseTeam.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar miembro del equipo base:", error);
      throw error;
    }
  }

  async copyQuotationTeamToProject(quotationId: number, projectId: number): Promise<ProjectBaseTeam[]> {
    try {
      // Verificar si el proyecto ya tiene equipo base
      const existingTeam = await db.select().from(projectBaseTeam).where(eq(projectBaseTeam.projectId, projectId));
      
      if (existingTeam.length > 0) {
        // Si ya existe equipo, retornar el equipo existente sin crear duplicados
        return existingTeam;
      }

      // Obtener el equipo de la cotización
      const quotationTeam = await db.select({
        personnelId: quotationTeamMembers.personnelId,
        roleId: quotationTeamMembers.roleId,
        hours: quotationTeamMembers.hours,
        rate: quotationTeamMembers.rate
      }).from(quotationTeamMembers).where(eq(quotationTeamMembers.quotationId, quotationId));

      // Crear el equipo base del proyecto - filtrar solo miembros con personnelId válido
      const baseTeam: InsertProjectBaseTeam[] = quotationTeam
        .filter(member => member.personnelId !== null)
        .map(member => ({
          projectId,
          personnelId: member.personnelId!,
          roleId: member.roleId || 1, // Default role if null
          estimatedHours: member.hours,
          hourlyRate: member.rate,
          isActive: true
        }));

      if (baseTeam.length > 0) {
        return await db.insert(projectBaseTeam).values(baseTeam).returning();
      }

      return [];
    } catch (error) {
      console.error("Error al copiar equipo de cotización a proyecto:", error);
      throw error;
    }
  }

  // ==================== QUICK TIME ENTRY OPERATIONS ====================
  async getQuickTimeEntries(projectId: number): Promise<QuickTimeEntry[]> {
    try {
      return await db.select().from(quickTimeEntries).where(eq(quickTimeEntries.projectId, projectId)).orderBy(desc(quickTimeEntries.createdAt));
    } catch (error) {
      console.error("Error al obtener registros rápidos de tiempo:", error);
      throw error;
    }
  }

  async getQuickTimeEntry(id: number): Promise<QuickTimeEntry | undefined> {
    try {
      const [entry] = await db.select().from(quickTimeEntries).where(eq(quickTimeEntries.id, id));
      return entry;
    } catch (error) {
      console.error("Error al obtener registro rápido de tiempo:", error);
      throw error;
    }
  }

  async createQuickTimeEntry(entry: InsertQuickTimeEntry): Promise<QuickTimeEntry> {
    try {
      const [created] = await db.insert(quickTimeEntries).values(entry).returning();
      return created;
    } catch (error) {
      console.error("Error al crear registro rápido de tiempo:", error);
      throw error;
    }
  }

  async updateQuickTimeEntry(id: number, entry: Partial<InsertQuickTimeEntry>): Promise<QuickTimeEntry | undefined> {
    try {
      const [updated] = await db.update(quickTimeEntries).set(entry).where(eq(quickTimeEntries.id, id)).returning();
      return updated;
    } catch (error) {
      console.error("Error al actualizar registro rápido de tiempo:", error);
      throw error;
    }
  }

  async deleteQuickTimeEntry(id: number): Promise<boolean> {
    try {
      // Eliminar detalles primero
      await db.delete(quickTimeEntryDetails).where(eq(quickTimeEntryDetails.quickTimeEntryId, id));
      // Eliminar entrada principal
      await db.delete(quickTimeEntries).where(eq(quickTimeEntries.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar registro rápido de tiempo:", error);
      throw error;
    }
  }

  async getQuickTimeEntryDetails(quickTimeEntryId: number): Promise<QuickTimeEntryDetail[]> {
    try {
      return await db.select().from(quickTimeEntryDetails).where(eq(quickTimeEntryDetails.quickTimeEntryId, quickTimeEntryId));
    } catch (error) {
      console.error("Error al obtener detalles de registro rápido:", error);
      throw error;
    }
  }

  async createQuickTimeEntryDetail(detail: InsertQuickTimeEntryDetail): Promise<QuickTimeEntryDetail> {
    try {
      const [created] = await db.insert(quickTimeEntryDetails).values(detail).returning();

      // Actualizar totales del registro principal
      await this.updateQuickTimeEntryTotals(detail.quickTimeEntryId);

      return created;
    } catch (error) {
      console.error("Error al crear detalle de registro rápido:", error);
      throw error;
    }
  }

  async updateQuickTimeEntryDetail(id: number, detail: Partial<InsertQuickTimeEntryDetail>): Promise<QuickTimeEntryDetail | undefined> {
    try {
      const [updated] = await db.update(quickTimeEntryDetails).set(detail).where(eq(quickTimeEntryDetails.id, id)).returning();

      if (updated) {
        // Actualizar totales del registro principal
        await this.updateQuickTimeEntryTotals(updated.quickTimeEntryId);
      }

      return updated;
    } catch (error) {
      console.error("Error al actualizar detalle de registro rápido:", error);
      throw error;
    }
  }

  async deleteQuickTimeEntryDetail(id: number): Promise<boolean> {
    try {
      const [detail] = await db.select().from(quickTimeEntryDetails).where(eq(quickTimeEntryDetails.id, id));
      if (detail) {
        await db.delete(quickTimeEntryDetails).where(eq(quickTimeEntryDetails.id, id));
        // Actualizar totales del registro principal
        await this.updateQuickTimeEntryTotals(detail.quickTimeEntryId);
      }
      return true;
    } catch (error) {
      console.error("Error al eliminar detalle de registro rápido:", error);
      throw error;
    }
  }

  async submitQuickTimeEntry(id: number): Promise<QuickTimeEntry | undefined> {
    try {
      const [updated] = await db.update(quickTimeEntries)
        .set({ 
          status: "submitted",
          submittedAt: new Date()
        })
        .where(eq(quickTimeEntries.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error al enviar registro rápido de tiempo:", error);
      throw error;
    }
  }

  async approveQuickTimeEntry(id: number, approverId: number): Promise<QuickTimeEntry | undefined> {
    try {
      const [updated] = await db.update(quickTimeEntries)
        .set({ 
          status: "approved",
          approvedAt: new Date(),
          approvedBy: approverId
        })
        .where(eq(quickTimeEntries.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error al aprobar registro rápido de tiempo:", error);
      throw error;
    }
  }

  private async updateQuickTimeEntryTotals(quickTimeEntryId: number): Promise<void> {
    try {
      const details = await this.getQuickTimeEntryDetails(quickTimeEntryId);
      const totalHours = details.reduce((sum, detail) => sum + detail.hours, 0);
      const totalCost = details.reduce((sum, detail) => sum + detail.totalCost, 0);

      await db.update(quickTimeEntries)
        .set({ totalHours, totalCost })
        .where(eq(quickTimeEntries.id, quickTimeEntryId));
    } catch (error) {
      console.error("Error al actualizar totales de registro rápido:", error);
      throw error;
    }
  }

  // ==================== UNQUOTED PERSONNEL OPERATIONS ====================

  async assignUnquotedPersonnel(projectId: number, personnelId: number, estimatedHours: number, hourlyRate: number): Promise<UnquotedPersonnel> {
    try {
      console.log(`🔧 Assigning unquoted personnel: projectId=${projectId}, personnelId=${personnelId}, estimatedHours=${estimatedHours}, hourlyRate=${hourlyRate}`);
      
      // Verificar si ya existe una asignación para este personal en este proyecto
      const existing = await db.select()
        .from(unquotedPersonnel)
        .where(
          and(
            eq(unquotedPersonnel.projectId, projectId),
            eq(unquotedPersonnel.personnelId, personnelId)
          )
        );

      if (existing.length > 0) {
        console.log(`✅ Personnel ${personnelId} already assigned to project ${projectId}, updating hours`);
        // Actualizar las horas existentes
        const [updated] = await db.update(unquotedPersonnel)
          .set({ 
            estimatedHours, 
            hourlyRate,
            assignedDate: new Date()
          })
          .where(eq(unquotedPersonnel.id, existing[0].id))
          .returning();
        return updated;
      }

      // Crear nueva asignación
      const [created] = await db.insert(unquotedPersonnel)
        .values({
          projectId,
          personnelId,
          estimatedHours,
          hourlyRate,
          assignedBy: null, // TODO: Add user ID from session
          notes: "Asignación automática al registrar tiempo"
        })
        .returning();

      console.log(`✅ Successfully assigned unquoted personnel:`, created);
      return created;
    } catch (error) {
      console.error("Error assigning unquoted personnel:", error);
      throw error;
    }
  }

  async getUnquotedPersonnel(projectId: number): Promise<any[]> {
    try {
      const result = await db.select({
        id: unquotedPersonnel.id,
        personnelId: unquotedPersonnel.personnelId,
        estimatedHours: unquotedPersonnel.estimatedHours,
        hourlyRate: unquotedPersonnel.hourlyRate,
        assignedDate: unquotedPersonnel.assignedDate,
        notes: unquotedPersonnel.notes,
        personnelName: personnel.name,
        personnelEmail: personnel.email,
      })
      .from(unquotedPersonnel)
      .leftJoin(personnel, eq(unquotedPersonnel.personnelId, personnel.id))
      .where(eq(unquotedPersonnel.projectId, projectId));

      return result;
    } catch (error) {
      console.error("Error getting unquoted personnel:", error);
      throw error;
    }
  }

  async getUnquotedPersonnelByProject(projectId: number): Promise<any[]> {
    try {
      const result = await db.select({
        id: unquotedPersonnel.id,
        personnelId: unquotedPersonnel.personnelId,
        estimatedHours: unquotedPersonnel.estimatedHours,
        estimatedRate: unquotedPersonnel.hourlyRate,
        assignedDate: unquotedPersonnel.assignedDate,
        notes: unquotedPersonnel.notes,
        personnelName: personnel.name,
        personnelEmail: personnel.email,
        personnelHourlyRate: personnel.hourlyRate,
        roleName: roles.name,
        roleDescription: roles.description
      })
      .from(unquotedPersonnel)
      .leftJoin(personnel, eq(unquotedPersonnel.personnelId, personnel.id))
      .leftJoin(roles, eq(personnel.roleId, roles.id))
      .where(eq(unquotedPersonnel.projectId, projectId));

      return result.map(row => ({
        ...row,
        personnel: {
          name: row.personnelName,
          email: row.personnelEmail,
          hourlyRate: row.personnelHourlyRate
        },
        role: {
          name: row.roleName,
          description: row.roleDescription
        }
      }));
    } catch (error) {
      console.error("Error getting unquoted personnel by project:", error);
      throw error;
    }
  }

  async checkIfPersonnelIsUnquoted(projectId: number, personnelId: number): Promise<boolean> {
    try {
      // Verificar si el personal está en el equipo base de la cotización
      const project = await this.getActiveProject(projectId);
      if (!project || !project.quotationId) {
        return false;
      }

      const quotationTeam = await this.getQuotationTeamMembers(project.quotationId);
      const isInQuotation = quotationTeam.some(member => member.personnelId === personnelId);
      
      return !isInQuotation;
    } catch (error) {
      console.error("Error checking if personnel is unquoted:", error);
      return false;
    }
  }

  // ==================== MONTHLY HOUR ADJUSTMENTS OPERATIONS ====================

  async getMonthlyHourAdjustments(projectId: number): Promise<MonthlyHourAdjustment[]> {
    try {
      const result = await db.select({
        id: monthlyHourAdjustments.id,
        projectId: monthlyHourAdjustments.projectId,
        personnelId: monthlyHourAdjustments.personnelId,
        year: monthlyHourAdjustments.year,
        month: monthlyHourAdjustments.month,
        adjustedHours: monthlyHourAdjustments.adjustedHours,
        reason: monthlyHourAdjustments.reason,
        createdBy: monthlyHourAdjustments.createdBy,
        createdAt: monthlyHourAdjustments.createdAt
      })
      .from(monthlyHourAdjustments)
      .where(eq(monthlyHourAdjustments.projectId, projectId));

      return result;
    } catch (error) {
      console.error("Error getting monthly hour adjustments:", error);
      throw error;
    }
  }

  async getMonthlyHourAdjustment(projectId: number, personnelId: number, year: number, month: number): Promise<MonthlyHourAdjustment | undefined> {
    try {
      const [result] = await db.select()
        .from(monthlyHourAdjustments)
        .where(
          and(
            eq(monthlyHourAdjustments.projectId, projectId),
            eq(monthlyHourAdjustments.personnelId, personnelId),
            eq(monthlyHourAdjustments.year, year),
            eq(monthlyHourAdjustments.month, month)
          )
        );

      return result;
    } catch (error) {
      console.error("Error getting monthly hour adjustment:", error);
      throw error;
    }
  }

  async createMonthlyHourAdjustment(adjustment: InsertMonthlyHourAdjustment): Promise<MonthlyHourAdjustment> {
    try {
      console.log(`🔧 Creating monthly hour adjustment:`, adjustment);
      
      // Verificar si ya existe un ajuste para este período
      const existing = await this.getMonthlyHourAdjustment(
        adjustment.projectId, 
        adjustment.personnelId, 
        adjustment.year, 
        adjustment.month
      );

      if (existing) {
        // Actualizar el ajuste existente
        const [updated] = await db.update(monthlyHourAdjustments)
          .set({ 
            adjustedHours: adjustment.adjustedHours,
            reason: adjustment.reason,
            createdBy: adjustment.createdBy
          })
          .where(eq(monthlyHourAdjustments.id, existing.id))
          .returning();
        
        console.log(`✅ Updated existing monthly hour adjustment:`, updated);
        return updated;
      }

      // Crear nuevo ajuste
      const [created] = await db.insert(monthlyHourAdjustments)
        .values(adjustment)
        .returning();

      console.log(`✅ Successfully created monthly hour adjustment:`, created);
      return created;
    } catch (error) {
      console.error("Error creating monthly hour adjustment:", error);
      throw error;
    }
  }

  async updateMonthlyHourAdjustment(id: number, adjustment: Partial<InsertMonthlyHourAdjustment>): Promise<MonthlyHourAdjustment | undefined> {
    try {
      const [updated] = await db.update(monthlyHourAdjustments)
        .set(adjustment)
        .where(eq(monthlyHourAdjustments.id, id))
        .returning();

      return updated;
    } catch (error) {
      console.error("Error updating monthly hour adjustment:", error);
      throw error;
    }
  }

  async deleteMonthlyHourAdjustment(id: number): Promise<boolean> {
    try {
      await db.delete(monthlyHourAdjustments)
        .where(eq(monthlyHourAdjustments.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting monthly hour adjustment:", error);
      return false;
    }
  }

  // ==================== PROJECT PRICE ADJUSTMENT OPERATIONS ====================

  async getProjectPriceAdjustments(projectId: number): Promise<ProjectPriceAdjustment[]> {
    try {
      const result = await db.select({
        id: projectPriceAdjustments.id,
        projectId: projectPriceAdjustments.projectId,
        previousPrice: projectPriceAdjustments.previousPrice,
        newPrice: projectPriceAdjustments.newPrice,
        adjustmentPercentage: projectPriceAdjustments.adjustmentPercentage,
        effectiveDate: projectPriceAdjustments.effectiveDate,
        reason: projectPriceAdjustments.reason,
        changeType: projectPriceAdjustments.changeType,
        clientNotified: projectPriceAdjustments.clientNotified,
        clientApproval: projectPriceAdjustments.clientApproval,
        approvalDate: projectPriceAdjustments.approvalDate,
        notes: projectPriceAdjustments.notes,
        createdBy: projectPriceAdjustments.createdBy,
        createdAt: projectPriceAdjustments.createdAt
      })
      .from(projectPriceAdjustments)
      .where(eq(projectPriceAdjustments.projectId, projectId))
      .orderBy(desc(projectPriceAdjustments.effectiveDate));

      return result;
    } catch (error) {
      console.error("Error getting project price adjustments:", error);
      throw error;
    }
  }

  async getProjectPriceAdjustment(id: number): Promise<ProjectPriceAdjustment | undefined> {
    try {
      const [result] = await db.select()
        .from(projectPriceAdjustments)
        .where(eq(projectPriceAdjustments.id, id));

      return result;
    } catch (error) {
      console.error("Error getting project price adjustment:", error);
      throw error;
    }
  }

  async createProjectPriceAdjustment(adjustment: InsertProjectPriceAdjustment): Promise<ProjectPriceAdjustment> {
    try {
      console.log(`🔧 Creating project price adjustment:`, adjustment);
      
      const [created] = await db.insert(projectPriceAdjustments)
        .values(adjustment)
        .returning();
        
      console.log(`✅ Successfully created project price adjustment:`, created);
      return created;
    } catch (error) {
      console.error("Error creating project price adjustment:", error);
      throw error;
    }
  }

  async updateProjectPriceAdjustment(id: number, adjustment: Partial<InsertProjectPriceAdjustment>): Promise<ProjectPriceAdjustment | undefined> {
    try {
      const [updated] = await db.update(projectPriceAdjustments)
        .set(adjustment)
        .where(eq(projectPriceAdjustments.id, id))
        .returning();

      return updated;
    } catch (error) {
      console.error("Error updating project price adjustment:", error);
      throw error;
    }
  }

  async deleteProjectPriceAdjustment(id: number): Promise<boolean> {
    try {
      await db.delete(projectPriceAdjustments)
        .where(eq(projectPriceAdjustments.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting project price adjustment:", error);
      return false;
    }
  }

  async getCurrentProjectPrice(projectId: number): Promise<number> {
    try {
      // Buscar el último ajuste de precio válido para el proyecto
      const [latestAdjustment] = await db.select()
        .from(projectPriceAdjustments)
        .where(eq(projectPriceAdjustments.projectId, projectId))
        .orderBy(desc(projectPriceAdjustments.effectiveDate))
        .limit(1);

      if (latestAdjustment) {
        return Number(latestAdjustment.newPrice);
      }

      // Si no hay ajustes, devolver el precio original del proyecto
      const project = await this.getActiveProject(projectId);
      if (project && project.quotation) {
        return Number(project.quotation.totalAmount || 0);
      }

      return 0;
    } catch (error) {
      console.error("Error getting current project price:", error);
      return 0;
    }
  }

  // ==================== INDIRECT COST CATEGORY OPERATIONS ====================

  async getIndirectCostCategories(): Promise<IndirectCostCategory[]> {
    return db.select().from(indirectCostCategories)
      .where(eq(indirectCostCategories.isActive, true))
      .orderBy(asc(indirectCostCategories.name));
  }

  async getIndirectCostCategory(id: number): Promise<IndirectCostCategory | undefined> {
    const [category] = await db.select().from(indirectCostCategories)
      .where(eq(indirectCostCategories.id, id));
    return category || undefined;
  }

  async createIndirectCostCategory(category: InsertIndirectCostCategory): Promise<IndirectCostCategory> {
    const [created] = await db.insert(indirectCostCategories)
      .values(category)
      .returning();
    return created;
  }

  async updateIndirectCostCategory(id: number, category: Partial<InsertIndirectCostCategory>): Promise<IndirectCostCategory | undefined> {
    try {
      const [updated] = await db.update(indirectCostCategories)
        .set(category)
        .where(eq(indirectCostCategories.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("Error updating indirect cost category:", error);
      return undefined;
    }
  }

  async deleteIndirectCostCategory(id: number): Promise<boolean> {
    try {
      await db.update(indirectCostCategories)
        .set({ isActive: false })
        .where(eq(indirectCostCategories.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting indirect cost category:", error);
      return false;
    }
  }

  // ==================== INDIRECT COST OPERATIONS ====================

  async getIndirectCosts(): Promise<IndirectCost[]> {
    return db.select().from(indirectCosts)
      .where(eq(indirectCosts.isActive, true))
      .orderBy(desc(indirectCosts.startDate));
  }

  async getIndirectCostsByCategory(categoryId: number): Promise<IndirectCost[]> {
    return db.select().from(indirectCosts)
      .where(and(
        eq(indirectCosts.categoryId, categoryId),
        eq(indirectCosts.isActive, true)
      ))
      .orderBy(desc(indirectCosts.startDate));
  }

  async getIndirectCost(id: number): Promise<IndirectCost | undefined> {
    const [cost] = await db.select().from(indirectCosts)
      .where(eq(indirectCosts.id, id));
    return cost || undefined;
  }

  async createIndirectCost(cost: InsertIndirectCost): Promise<IndirectCost> {
    const [created] = await db.insert(indirectCosts)
      .values(cost)
      .returning();
    return created;
  }

  async updateIndirectCost(id: number, cost: Partial<InsertIndirectCost>): Promise<IndirectCost | undefined> {
    try {
      const [updated] = await db.update(indirectCosts)
        .set(cost)
        .where(eq(indirectCosts.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("Error updating indirect cost:", error);
      return undefined;
    }
  }

  async deleteIndirectCost(id: number): Promise<boolean> {
    try {
      await db.update(indirectCosts)
        .set({ isActive: false })
        .where(eq(indirectCosts.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting indirect cost:", error);
      return false;
    }
  }

  // ==================== NON-BILLABLE HOURS OPERATIONS ====================

  async getNonBillableHours(): Promise<NonBillableHours[]> {
    return db.select().from(nonBillableHours)
      .orderBy(desc(nonBillableHours.date));
  }

  async getNonBillableHoursByPersonnel(personnelId: number): Promise<NonBillableHours[]> {
    return db.select().from(nonBillableHours)
      .where(eq(nonBillableHours.personnelId, personnelId))
      .orderBy(desc(nonBillableHours.date));
  }

  async getNonBillableHoursByCategory(categoryId: number): Promise<NonBillableHours[]> {
    return db.select().from(nonBillableHours)
      .where(eq(nonBillableHours.categoryId, categoryId))
      .orderBy(desc(nonBillableHours.date));
  }

  async createNonBillableHours(hours: InsertNonBillableHours): Promise<NonBillableHours> {
    const [created] = await db.insert(nonBillableHours)
      .values(hours)
      .returning();
    return created;
  }

  async updateNonBillableHours(id: number, hours: Partial<InsertNonBillableHours>): Promise<NonBillableHours | undefined> {
    try {
      const [updated] = await db.update(nonBillableHours)
        .set(hours)
        .where(eq(nonBillableHours.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("Error updating non-billable hours:", error);
      return undefined;
    }
  }

  async deleteNonBillableHours(id: number): Promise<boolean> {
    try {
      await db.delete(nonBillableHours)
        .where(eq(nonBillableHours.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting non-billable hours:", error);
      return false;
    }
  }

  // Exchange Rate operations
  async getExchangeRates(): Promise<ExchangeRate[]> {
    return db.select().from(exchangeRates)
      .orderBy(desc(exchangeRates.year), desc(exchangeRates.month));
  }

  async getExchangeRateByMonth(year: number, month: number): Promise<ExchangeRate | undefined> {
    const [rate] = await db.select().from(exchangeRates)
      .where(and(
        eq(exchangeRates.year, year),
        eq(exchangeRates.month, month)
      ))
      .limit(1);
    return rate || undefined;
  }

  async createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate> {
    const [created] = await db.insert(exchangeRates)
      .values(rate)
      .returning();
    return created;
  }

  async bulkCreateExchangeRates(rates: InsertExchangeRate[]): Promise<ExchangeRate[]> {
    const created = await db.insert(exchangeRates)
      .values(rates)
      .returning();
    return created;
  }

  async getExchangeRatesByYear(year: number): Promise<ExchangeRate[]> {
    return db.select().from(exchangeRates)
      .where(eq(exchangeRates.year, year))
      .orderBy(exchangeRates.month);
  }

  async updateExchangeRate(id: number, exchangeRate: Partial<InsertExchangeRate>): Promise<ExchangeRate | undefined> {
    try {
      const [updated] = await db.update(exchangeRates)
        .set({
          ...exchangeRate,
          updatedAt: new Date(),
        })
        .where(eq(exchangeRates.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error("Error updating exchange rate:", error);
      return undefined;
    }
  }

  async deleteExchangeRate(id: number): Promise<boolean> {
    try {
      await db.delete(exchangeRates)
        .where(eq(exchangeRates.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting exchange rate:", error);
      return false;
    }
  }

  async getLatestExchangeRate(): Promise<ExchangeRate | undefined> {
    const [rate] = await db.select().from(exchangeRates)
      .where(eq(exchangeRates.isActive, true))
      .orderBy(desc(exchangeRates.year), desc(exchangeRates.month))
      .limit(1);
    return rate || undefined;
  }

  // ==================== PERSONNEL HISTORICAL COSTS (Usando campos en personnel) ====================
  // Note: Historical costs are now managed through the personnel table monthly fields

  // Personnel historical costs are now managed via personnel table monthly fields

  /**
   * Obtiene el costo efectivo por hora de una persona para un período específico.
   * Busca primero en costos históricos, si no encuentra usa el costo actual.
   */
  async getEffectivePersonnelCostForPeriod(personnelId: number, year: number, month: number): Promise<number | undefined> {
    const person = await this.getPersonnelById(personnelId);
    if (!person) return undefined;

    // Try to get historical rate from personnel table monthly fields
    const monthField = getHistoricalMonthField(year, month, 'hourly');
    const historicalRate = (person as any)[monthField];
    
    if (historicalRate && historicalRate > 0) {
      return historicalRate;
    }

    // Fallback to current rate
    return person.hourlyRateARS || undefined;
  }

  // ==================== GOOGLE SHEETS PROJECTS OPERATIONS ====================
  
  async getGoogleSheetsProjects(): Promise<GoogleSheetsProject[]> {
    return await db.select().from(googleSheetsProjects).orderBy(desc(googleSheetsProjects.createdDate));
  }

  async getGoogleSheetsProject(id: number): Promise<GoogleSheetsProject | undefined> {
    const [project] = await db.select().from(googleSheetsProjects).where(eq(googleSheetsProjects.id, id));
    return project;
  }

  async getGoogleSheetsProjectByKey(googleSheetsKey: string): Promise<GoogleSheetsProject | undefined> {
    const [project] = await db.select().from(googleSheetsProjects).where(eq(googleSheetsProjects.googleSheetsKey, googleSheetsKey));
    return project;
  }

  async createGoogleSheetsProject(project: InsertGoogleSheetsProject): Promise<GoogleSheetsProject> {
    const [newProject] = await db.insert(googleSheetsProjects).values(project).returning();
    return newProject;
  }

  async updateGoogleSheetsProject(id: number, project: Partial<InsertGoogleSheetsProject>): Promise<GoogleSheetsProject | undefined> {
    const [updatedProject] = await db
      .update(googleSheetsProjects)
      .set({ ...project, lastUpdated: new Date() })
      .where(eq(googleSheetsProjects.id, id))
      .returning();
    return updatedProject;
  }

  async deleteGoogleSheetsProject(id: number): Promise<boolean> {
    try {
      await db.transaction(async (tx) => {
        // Delete all billing records first
        await tx.delete(googleSheetsProjectBilling).where(eq(googleSheetsProjectBilling.projectId, id));
        // Delete the project
        await tx.delete(googleSheetsProjects).where(eq(googleSheetsProjects.id, id));
      });
      return true;
    } catch (error) {
      console.error("Error deleting Google Sheets project:", error);
      return false;
    }
  }

  // ==================== GOOGLE SHEETS PROJECT BILLING OPERATIONS ====================
  
  async getProjectBillingRecords(projectId: number): Promise<GoogleSheetsProjectBilling[]> {
    return await db.select()
      .from(googleSheetsProjectBilling)
      .where(eq(googleSheetsProjectBilling.projectId, projectId))
      .orderBy(googleSheetsProjectBilling.billingYear, googleSheetsProjectBilling.billingMonth);
  }

  async getProjectBillingRecord(id: number): Promise<GoogleSheetsProjectBilling | undefined> {
    const [record] = await db.select().from(googleSheetsProjectBilling).where(eq(googleSheetsProjectBilling.id, id));
    return record;
  }

  async createProjectBillingRecord(billing: InsertGoogleSheetsProjectBilling): Promise<GoogleSheetsProjectBilling> {
    const [newRecord] = await db.insert(googleSheetsProjectBilling).values(billing).returning();
    return newRecord;
  }

  async updateProjectBillingRecord(id: number, billing: Partial<InsertGoogleSheetsProjectBilling>): Promise<GoogleSheetsProjectBilling | undefined> {
    const [updatedRecord] = await db
      .update(googleSheetsProjectBilling)
      .set(billing)
      .where(eq(googleSheetsProjectBilling.id, id))
      .returning();
    return updatedRecord;
  }

  async deleteProjectBillingRecord(id: number): Promise<boolean> {
    try {
      await db.delete(googleSheetsProjectBilling).where(eq(googleSheetsProjectBilling.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting project billing record:", error);
      return false;
    }
  }

  // ==================== GOOGLE SHEETS IMPORT OPERATIONS ====================
  
  async importGoogleSheetsProjects(projectsData: any[]): Promise<{ imported: number; updated: number; errors: string[] }> {
    const results = { imported: 0, updated: 0, errors: [] };
    
    try {
      // Utility function to parse amounts
      const parseAmount = (amountStr: string | number): number => {
        if (typeof amountStr === 'number') return amountStr;
        if (!amountStr) return 0;
        // Remove $ and , from the string and convert to number
        return parseFloat(amountStr.toString().replace(/[$,]/g, '')) || 0;
      };

      // Utility function to parse month to date
      const parseMonthToDate = (monthStr: string, year: number): Date => {
        const monthMap: { [key: string]: number } = {
          'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
        };
        
        const monthName = monthStr.split(' ')[1]; // Extract month from "01 ene"
        const monthIndex = monthMap[monthName] || 0;
        return new Date(year, monthIndex, 1);
      };

      // Group projects by unique key (client + project name)
      const uniqueProjects = new Map<string, any[]>();
      
      for (const project of projectsData) {
        const key = `${project.cliente}_${project.detalle}`;
        if (!uniqueProjects.has(key)) {
          uniqueProjects.set(key, []);
        }
        uniqueProjects.get(key)!.push(project);
      }

      // Process each unique project
      for (const [key, projectRecords] of Array.from(uniqueProjects.entries())) {
        try {
          // Sort records by billing month to find first occurrence
          projectRecords.sort((a: any, b: any) => {
            if (a.añoFacturacion !== b.añoFacturacion) {
              return a.añoFacturacion - b.añoFacturacion;
            }
            return a.mesFacturacion.localeCompare(b.mesFacturacion);
          });

          const firstRecord = projectRecords[0];
          const lastRecord = projectRecords[projectRecords.length - 1];

          // Determine currency and amounts
          const originalCurrency = firstRecord.monedaUSD > 0 ? 'USD' : 'ARS';
          const originalAmountUSD = parseAmount(firstRecord.monedaUSD);
          const originalAmountARS = parseAmount(firstRecord.monedaARS);
          const currentAmountUSD = parseAmount(lastRecord.monedaUSD);
          const currentAmountARS = parseAmount(lastRecord.monedaARS);

          // Check if project already exists
          const existingProject = await this.getGoogleSheetsProjectByKey(key);

          const projectData: InsertGoogleSheetsProject = {
            clientName: firstRecord.cliente,
            projectName: firstRecord.detalle,
            projectType: firstRecord.proyecto,
            isConfirmed: firstRecord.confirmado === 'Si' || firstRecord.confirmado === true,
            paymentTerms: parseInt(firstRecord.condicionPago) || null,
            firstBillingMonth: firstRecord.mesFacturacion,
            firstBillingYear: firstRecord.añoFacturacion,
            createdDate: parseMonthToDate(firstRecord.mesFacturacion, firstRecord.añoFacturacion),
            originalCurrency,
            originalAmountARS: originalAmountARS || null,
            originalAmountUSD: originalAmountUSD || null,
            currentAmountARS: currentAmountARS || null,
            currentAmountUSD: currentAmountUSD || null,
            googleSheetsKey: key
          };

          let savedProject: GoogleSheetsProject;

          if (existingProject) {
            // Update existing project
            const updated = await this.updateGoogleSheetsProject(existingProject.id, projectData);
            if (updated) {
              savedProject = updated;
              results.updated++;
            } else {
              throw new Error(`Failed to update project ${key}`);
            }
          } else {
            // Create new project
            savedProject = await this.createGoogleSheetsProject(projectData);
            results.imported++;
          }

          // Import all billing records
          for (const record of projectRecords) {
            const billingData: InsertGoogleSheetsProjectBilling = {
              projectId: savedProject.id,
              billingMonth: record.mesFacturacion,
              billingYear: record.añoFacturacion,
              collectionMonth: record.mesCobre || null,
              collectionYear: record.añoCobre || null,
              amountARS: parseAmount(record.monedaARS) || null,
              amountUSD: parseAmount(record.monedaUSD) || null,
              adjustment: parseAmount(record.ajuste) || 0,
              baseValue: parseAmount(record.valorBase) || null,
              invoiced: false // Default, could be enhanced later
            };

            await this.createProjectBillingRecord(billingData);
          }

        } catch (error: any) {
          results.errors.push(`Error processing project ${key}: ${(error as any)?.message || String(error)}`);
          console.error(`Error processing project ${key}:`, error);
        }
      }

    } catch (error: any) {
      results.errors.push(`General import error: ${(error as any)?.message || String(error)}`);
      console.error("Error in importGoogleSheetsProjects:", error);
    }

    return results;
  }

  // ==================== FINANCIAL MANAGEMENT IMPLEMENTATION ====================
  
  async getProjectMonthlyRevenue(projectId: number): Promise<ProjectMonthlyRevenue[]> {
    return await db
      .select()
      .from(projectMonthlyRevenue)
      .where(eq(projectMonthlyRevenue.projectId, projectId))
      .orderBy(desc(projectMonthlyRevenue.year), desc(projectMonthlyRevenue.month));
  }

  async getProjectMonthlyRevenueByPeriod(projectId: number, year: number, month: number): Promise<ProjectMonthlyRevenue | undefined> {
    const result = await db
      .select()
      .from(projectMonthlyRevenue)
      .where(
        and(
          eq(projectMonthlyRevenue.projectId, projectId),
          eq(projectMonthlyRevenue.year, year),
          eq(projectMonthlyRevenue.month, month)
        )
      )
      .limit(1);
    return result[0];
  }

  async createProjectMonthlyRevenue(revenue: InsertProjectMonthlyRevenue): Promise<ProjectMonthlyRevenue> {
    const result = await db
      .insert(projectMonthlyRevenue)
      .values(revenue)
      .returning();
    return result[0];
  }

  async updateProjectMonthlyRevenue(id: number, revenue: Partial<InsertProjectMonthlyRevenue>): Promise<ProjectMonthlyRevenue | undefined> {
    const result = await db
      .update(projectMonthlyRevenue)
      .set({ ...revenue, updatedAt: new Date() })
      .where(eq(projectMonthlyRevenue.id, id))
      .returning();
    return result[0];
  }

  async deleteProjectMonthlyRevenue(id: number): Promise<boolean> {
    const result = await db
      .delete(projectMonthlyRevenue)
      .where(eq(projectMonthlyRevenue.id, id));
    return result.rowCount! > 0;
  }

  async getProjectPricingChanges(projectId: number): Promise<ProjectPricingChange[]> {
    return await db
      .select()
      .from(projectPricingChanges)
      .where(eq(projectPricingChanges.projectId, projectId))
      .orderBy(desc(projectPricingChanges.effectiveFromYear), desc(projectPricingChanges.effectiveFromMonth));
  }

  async getCurrentProjectPricing(projectId: number, year: number, month: number): Promise<ProjectPricingChange | undefined> {
    const result = await db
      .select()
      .from(projectPricingChanges)
      .where(
        and(
          eq(projectPricingChanges.projectId, projectId),
          sql`(effective_from_year < ${year} OR (effective_from_year = ${year} AND effective_from_month <= ${month}))`,
          sql`(effective_to_year IS NULL OR effective_to_year > ${year} OR (effective_to_year = ${year} AND effective_to_month >= ${month}))`
        )
      )
      .orderBy(desc(projectPricingChanges.effectiveFromYear), desc(projectPricingChanges.effectiveFromMonth))
      .limit(1);
    return result[0];
  }

  async createProjectPricingChange(change: InsertProjectPricingChange): Promise<ProjectPricingChange> {
    const result = await db
      .insert(projectPricingChanges)
      .values(change)
      .returning();
    return result[0];
  }

  async getProjectFinancialSummary(projectId: number): Promise<ProjectFinancialSummary | undefined> {
    const result = await db
      .select()
      .from(projectFinancialSummary)
      .where(eq(projectFinancialSummary.projectId, projectId))
      .limit(1);
    return result[0];
  }

  async updateProjectFinancialSummary(projectId: number, summary: Partial<InsertProjectFinancialSummary>): Promise<ProjectFinancialSummary> {
    // Intentar actualizar primero
    const updateResult = await db
      .update(projectFinancialSummary)
      .set({ ...summary, updatedAt: new Date() })
      .where(eq(projectFinancialSummary.projectId, projectId))
      .returning();

    if (updateResult.length > 0) {
      return updateResult[0];
    }

    // Si no existe, crear nuevo
    const insertResult = await db
      .insert(projectFinancialSummary)
      .values({ projectId, ...summary })
      .returning();
    return insertResult[0];
  }

  async calculateAndUpdateFinancialSummary(projectId: number): Promise<ProjectFinancialSummary> {
    // Obtener todos los ingresos mensuales del proyecto
    const revenues = await this.getProjectMonthlyRevenue(projectId);
    
    // Calcular totales
    const totalRevenueUsd = revenues.reduce((sum, rev) => sum + Number(rev.amountUsd || 0), 0);
    const totalInvoicedUsd = revenues
      .filter(rev => rev.invoiced)
      .reduce((sum, rev) => sum + Number(rev.amountUsd || 0), 0);
    const totalCollectedUsd = revenues
      .filter(rev => rev.collected)
      .reduce((sum, rev) => sum + Number(rev.amountUsd || 0), 0);
    
    // Calcular pendientes
    const outstandingInvoicesUsd = totalInvoicedUsd - totalCollectedUsd;
    const pendingCollectionUsd = totalRevenueUsd - totalInvoicedUsd;
    
    // Obtener último registro para mes/año
    const lastRevenue = revenues[0];
    
    // Obtener pricing actual
    const currentPricing = lastRevenue ? 
      await this.getCurrentProjectPricing(projectId, lastRevenue.year, lastRevenue.month) :
      null;

    const summaryData: Partial<InsertProjectFinancialSummary> = {
      totalRevenueUsd: totalRevenueUsd.toString(),
      totalInvoicedUsd: totalInvoicedUsd.toString(),
      totalCollectedUsd: totalCollectedUsd.toString(),
      outstandingInvoicesUsd: outstandingInvoicesUsd.toString(),
      pendingCollectionUsd: pendingCollectionUsd.toString(),
      currentMonthlyRateUsd: currentPricing?.monthlyAmountUsd?.toString() || null,
      lastRevenueMonth: lastRevenue?.month || null,
      lastRevenueYear: lastRevenue?.year || null,
    };

    return await this.updateProjectFinancialSummary(projectId, summaryData);
  }

  async generateProjectFinancialReport(projectId: number): Promise<{
    totalRevenue: number;
    totalInvoiced: number;
    totalCollected: number;
    monthlyBreakdown: Array<{
      year: number;
      month: number;
      amount: number;
      invoiced: boolean;
      collected: boolean;
    }>;
  }> {
    const revenues = await this.getProjectMonthlyRevenue(projectId);
    
    return {
      totalRevenue: revenues.reduce((sum, rev) => sum + Number(rev.amountUsd || 0), 0),
      totalInvoiced: revenues.filter(rev => rev.invoiced).reduce((sum, rev) => sum + Number(rev.amountUsd || 0), 0),
      totalCollected: revenues.filter(rev => rev.collected).reduce((sum, rev) => sum + Number(rev.amountUsd || 0), 0),
      monthlyBreakdown: revenues.map(rev => ({
        year: rev.year,
        month: rev.month,
        amount: Number(rev.amountUsd || 0),
        invoiced: rev.invoiced || false,
        collected: rev.collected || false,
      }))
    };
  }

  async generateMonthlyRevenueForProject(
    projectId: number, 
    fromYear: number, 
    fromMonth: number, 
    toYear: number, 
    toMonth: number
  ): Promise<ProjectMonthlyRevenue[]> {
    const results: ProjectMonthlyRevenue[] = [];
    
    // Obtener el proyecto para verificar que es fee mensual
    const project = await this.getActiveProject(projectId);
    if (!project || !project.quotation || project.quotation.projectType !== 'fee-mensual') {
      throw new Error('Solo se pueden generar ingresos mensuales automáticamente para proyectos de fee mensual');
    }

    let currentYear = fromYear;
    let currentMonth = fromMonth;
    
    while (currentYear < toYear || (currentYear === toYear && currentMonth <= toMonth)) {
      // Verificar si ya existe un registro para este período
      const existing = await this.getProjectMonthlyRevenueByPeriod(projectId, currentYear, currentMonth);
      
      if (!existing) {
        // Obtener el pricing vigente para este período
        const pricing = await this.getCurrentProjectPricing(projectId, currentYear, currentMonth);
        const amount = pricing?.monthlyAmountUsd || project.quotation.totalAmount;

        const revenueData: InsertProjectMonthlyRevenue = {
          projectId,
          year: currentYear,
          month: currentMonth,
          amountUsd: amount.toString(),
          revenueSource: 'automated',
          createdBy: 1, // Usuario del sistema
        };

        const created = await this.createProjectMonthlyRevenue(revenueData);
        results.push(created);
      }

      // Avanzar al siguiente mes
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    // Actualizar el resumen financiero
    await this.calculateAndUpdateFinancialSummary(projectId);
    
    return results;
  }

  /**
   * Genera ingresos mensuales para CUALQUIER tipo de proyecto confirmado
   * Distribuye el valor total del proyecto a lo largo de su duración
   */
  async generateMonthlyRevenueForAnyProject(
    projectId: number, 
    fromYear: number, 
    fromMonth: number, 
    toYear: number, 
    toMonth: number
  ): Promise<ProjectMonthlyRevenue[]> {
    const results: ProjectMonthlyRevenue[] = [];
    
    // Obtener el proyecto 
    const project = await this.getActiveProject(projectId);
    if (!project || !project.quotation) {
      console.log(`❌ Project ${projectId} not found or has no quotation`);
      return results;
    }

    console.log(`💰 Generating revenue for project ${projectId}: ${project.quotation.projectName}`);
    console.log(`📊 Project type: ${project.quotation.projectType}, Total: $${project.quotation.totalAmount}`);

    // Calcular el número total de meses del proyecto
    let totalMonths = 0;
    let currentYear = fromYear;
    let currentMonth = fromMonth;
    
    while (currentYear < toYear || (currentYear === toYear && currentMonth <= toMonth)) {
      totalMonths++;
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    if (totalMonths === 0) {
      console.log(`❌ No months to process for project ${projectId}`);
      return results;
    }

    // Obtener valor total del proyecto
    const totalAmount = parseFloat(project.quotation.totalAmount.toString());
    
    // Para fee mensual, usar el valor mensual específico
    let monthlyAmount = totalAmount;
    if (project.quotation.projectType === 'fee-mensual') {
      // Para fee mensual, el totalAmount ya es el monto mensual
      monthlyAmount = totalAmount;
    } else {
      // Para otros tipos de proyectos, distribuir el total entre todos los meses
      monthlyAmount = totalAmount / totalMonths;
    }

    console.log(`📈 Monthly amount calculated: $${monthlyAmount.toFixed(2)} (${totalMonths} months total)`);

    // Resetear para generar los registros
    currentYear = fromYear;
    currentMonth = fromMonth;
    
    while (currentYear < toYear || (currentYear === toYear && currentMonth <= toMonth)) {
      // Verificar si ya existe un registro para este período
      const existing = await this.getProjectMonthlyRevenueByPeriod(projectId, currentYear, currentMonth);
      
      if (!existing) {
        // Obtener el pricing vigente para este período
        const pricing = await this.getCurrentProjectPricing(projectId, currentYear, currentMonth);
        const finalAmount = pricing?.monthlyAmountUsd || monthlyAmount;
        const finalAmountNumber = typeof finalAmount === 'string' ? parseFloat(finalAmount) : finalAmount;

        const revenueData: InsertProjectMonthlyRevenue = {
          projectId,
          year: currentYear,
          month: currentMonth,
          amountUsd: finalAmountNumber.toString(),
          revenueSource: 'excel_automated',
          createdBy: 1, // Usuario del sistema
        };

        const created = await this.createProjectMonthlyRevenue(revenueData);
        results.push(created);
        console.log(`✅ Created revenue for ${currentMonth}/${currentYear}: $${finalAmountNumber.toFixed(2)}`);
      } else {
        console.log(`⚠️ Revenue already exists for ${currentMonth}/${currentYear}: $${existing.amountUsd}`);
      }

      // Avanzar al siguiente mes
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    // Actualizar el resumen financiero
    await this.calculateAndUpdateFinancialSummary(projectId);
    
    console.log(`🎉 Generated ${results.length} new revenue records for project ${projectId}`);
    return results;
  }

  // ==================== IMPLEMENTACIÓN DE MÉTODOS PARA ANÁLISIS OPERACIONAL Y FINANCIERO ====================
  
  // Project Monthly Sales operations (análisis operacional)
  async getProjectMonthlySales(projectId: number): Promise<ProjectMonthlySales[]> {
    return await db
      .select()
      .from(projectMonthlySales)
      .where(eq(projectMonthlySales.projectId, projectId))
      .orderBy(desc(projectMonthlySales.year), desc(projectMonthlySales.month));
  }

  async getProjectMonthlySalesByPeriod(projectId: number, year: number, month: number): Promise<ProjectMonthlySales | undefined> {
    const result = await db
      .select()
      .from(projectMonthlySales)
      .where(
        and(
          eq(projectMonthlySales.projectId, projectId),
          eq(projectMonthlySales.year, year),
          eq(projectMonthlySales.month, month)
        )
      )
      .limit(1);
    return result[0];
  }

  async createProjectMonthlySales(sales: InsertProjectMonthlySales): Promise<ProjectMonthlySales> {
    const result = await db
      .insert(projectMonthlySales)
      .values(sales)
      .returning();
    return result[0];
  }

  async updateProjectMonthlySales(id: number, sales: Partial<InsertProjectMonthlySales>): Promise<ProjectMonthlySales | undefined> {
    const result = await db
      .update(projectMonthlySales)
      .set({ ...sales, updatedAt: new Date() })
      .where(eq(projectMonthlySales.id, id))
      .returning();
    return result[0];
  }

  async deleteProjectMonthlySales(id: number): Promise<boolean> {
    const result = await db
      .delete(projectMonthlySales)
      .where(eq(projectMonthlySales.id, id));
    return result.rowCount! > 0;
  }

  // Project Financial Transactions operations (análisis financiero)
  async getProjectFinancialTransactions(projectId: number): Promise<ProjectFinancialTransaction[]> {
    return await db
      .select()
      .from(projectFinancialTransactions)
      .where(eq(projectFinancialTransactions.projectId, projectId))
      .orderBy(desc(projectFinancialTransactions.invoiceDate), desc(projectFinancialTransactions.collectionDate));
  }

  async getProjectFinancialTransaction(id: number): Promise<ProjectFinancialTransaction | undefined> {
    const result = await db
      .select()
      .from(projectFinancialTransactions)
      .where(eq(projectFinancialTransactions.id, id))
      .limit(1);
    return result[0];
  }

  async createProjectFinancialTransaction(transaction: InsertProjectFinancialTransaction): Promise<ProjectFinancialTransaction> {
    const result = await db
      .insert(projectFinancialTransactions)
      .values(transaction)
      .returning();
    return result[0];
  }

  async updateProjectFinancialTransaction(id: number, transaction: Partial<InsertProjectFinancialTransaction>): Promise<ProjectFinancialTransaction | undefined> {
    const result = await db
      .update(projectFinancialTransactions)
      .set({ ...transaction, updatedAt: new Date() })
      .where(eq(projectFinancialTransactions.id, id))
      .returning();
    return result[0];
  }

  async deleteProjectFinancialTransaction(id: number): Promise<boolean> {
    const result = await db
      .delete(projectFinancialTransactions)
      .where(eq(projectFinancialTransactions.id, id));
    return result.rowCount! > 0;
  }

  // ==================== GOOGLE SHEETS SALES IMPORT OPERATIONS ====================
  
  async getGoogleSheetsSales(): Promise<GoogleSheetsSales[]> {
    return await db
      .select()
      .from(googleSheetsSales)
      .orderBy(desc(googleSheetsSales.year), desc(googleSheetsSales.monthNumber));
  }

  async getGoogleSheetsSalesByProject(projectId: number): Promise<GoogleSheetsSales[]> {
    return await db
      .select()
      .from(googleSheetsSales)
      .where(eq(googleSheetsSales.projectId, projectId))
      .orderBy(desc(googleSheetsSales.year), desc(googleSheetsSales.monthNumber));
  }

  async createGoogleSheetsSales(sales: InsertGoogleSheetsSales): Promise<GoogleSheetsSales> {
    const result = await db
      .insert(googleSheetsSales)
      .values(sales)
      .returning();
    return result[0];
  }

  async updateGoogleSheetsSales(id: number, sales: Partial<InsertGoogleSheetsSales>): Promise<GoogleSheetsSales | undefined> {
    const result = await db
      .update(googleSheetsSales)
      .set({ ...sales, lastUpdated: new Date() })
      .where(eq(googleSheetsSales.id, id))
      .returning();
    return result[0];
  }

  async deleteGoogleSheetsSales(id: number): Promise<boolean> {
    const result = await db
      .delete(googleSheetsSales)
      .where(eq(googleSheetsSales.id, id));
    return result.rowCount! > 0;
  }

  async clearGoogleSheetsSales(): Promise<boolean> {
    try {
      await db.delete(googleSheetsSales);
      return true;
    } catch (error) {
      console.error("Error clearing Google Sheets sales:", error);
      return false;
    }
  }

  async importSalesFromGoogleSheets(salesData: any[]): Promise<{ imported: number; updated: number; errors: string[] }> {
    const result = { imported: 0, updated: 0, errors: [] as string[] };
    const importBatch = `batch_${Date.now()}`;
    
    console.log(`🚀 NORMALIZADOR ÚNICO: Iniciando importación de ${salesData.length} registros...`);
    
    // 🎯 USAR NORMALIZADOR ÚNICO: Convertir datos crudos a formato estándar
    const { normalizeSales } = await import('./services/sales');
    
    // Mapear datos de entrada al formato esperado por el normalizador
    const rawSales = salesData.map(row => ({
      Cliente: String(row.cliente || '').trim(),
      Proyecto: String(row.proyecto || '').trim(), 
      Mes: String(row.mes || '').trim(),
      Año: parseInt(row.año) || new Date().getFullYear(),
      Monto_ARS: Number(row.monto_ars || row.montoArs || 0) || 0,
      Monto_USD: Number(row.monto_usd || row.montoUsd || 0) || 0,
      Confirmado: String(row.confirmado || 'SI').trim()
    }));
    
    // Normalizar TODAS las ventas usando lógica unificada
    let normalizedSales;
    try {
      normalizedSales = normalizeSales(rawSales);
      console.log(`✅ NORMALIZADOR: ${normalizedSales.length} ventas normalizadas exitosamente`);
    } catch (error: any) {
      result.errors.push(`Error en normalizador único: ${error.message}`);
      return result;
    }
    
    // Función para calcular estado automáticamente
    const calculateStatus = (monthKey: string): string => {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthKey < currentMonthKey) {
        return 'completada';
      } else if (monthKey === currentMonthKey) {
        return 'activa';
      } else {
        return 'proyectada';
      }
    };

    // Procesar cada venta normalizada
    for (let i = 0; i < normalizedSales.length; i++) {
      try {
        const normalized = normalizedSales[i];
        
        // Extraer información del monthKey para compatibilidad
        const [year, month] = normalized.monthKey.split('-');
        const monthNumber = parseInt(month);
        const yearNumber = parseInt(year);
        
        // Mapeo de números a nombres de meses para compatibilidad
        const monthNames = [
          '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const monthName = monthNames[monthNumber] || 'desconocido';
        
        const confirmed = 'SI'; // Ya filtrado por normalizador
        const salesType = 'fee'; // Default tipo de venta para compatibilidad

        // Calcular estado automáticamente usando monthKey
        const status = calculateStatus(normalized.monthKey);

        // Buscar cliente y proyecto en el sistema
        const client = await this.getClientByName(normalized.client);
        const projects = await this.getActiveProjects();
        const project = projects.find(p => 
          p.quotation?.projectName?.toLowerCase().includes(normalized.project.toLowerCase()) ||
          p.quotation?.clientProjectName?.toLowerCase().includes(normalized.project.toLowerCase())
        );

        // Crear clave única para evitar duplicados
        const uniqueKey = `${normalized.client}_${normalized.project}_${monthNumber}_${yearNumber}_${salesType}`.toLowerCase();
        
        // 🎯 PREPARAR DATOS USANDO INFORMACIÓN YA NORMALIZADA
        const salesRecord: InsertGoogleSheetsSales = {
          monthKey: normalized.monthKey,
          clientName: normalized.client,
          projectName: normalized.project,
          month: monthName,
          year: yearNumber,
          salesType,
          amountLocal: normalized.currency === 'ARS' ? String(normalized.originalAmount) : null,
          currency: normalized.currency,
          fxApplied: normalized.fx ? String(normalized.fx) : null,
          amountUsd: String(normalized.revenueUSD),
          fxSource: normalized.fx ? 'MonthTable' : 'Direct',
          fxAt: new Date(),
          confirmed,
          monthNumber,
          status,
          clientId: client?.id || null,
          projectId: project?.id || null,
          rowNumber: i + 1,
          importBatch,
          uniqueKey
        };

        // 💰 LOGGING MEJORADO: Mostrar información de normalización
        console.log(`💰 NORMALIZADOR RESULT: ${normalized.client}|${normalized.project} → ${normalized.currency} ${normalized.originalAmount} → USD ${normalized.revenueUSD}${normalized.antiX100Applied ? ' [ANTI×100]' : ''}${normalized.fx ? ` [FX:${normalized.fx}]` : ''}`);

        // Intentar insertar o actualizar
        try {
          const existing = await db
            .select()
            .from(googleSheetsSales)
            .where(eq(googleSheetsSales.uniqueKey, uniqueKey))
            .limit(1);

          if (existing.length > 0) {
            // Actualizar registro existente
            await this.updateGoogleSheetsSales(existing[0].id, salesRecord);
            result.updated++;
          } else {
            // Crear nuevo registro
            await this.createGoogleSheetsSales(salesRecord);
            result.imported++;
          }
        } catch (dbError: any) {
          if (dbError.code === '23505') { // Unique constraint violation
            result.errors.push(`Fila ${i + 1}: Registro duplicado - ${uniqueKey}`);
          } else {
            result.errors.push(`Fila ${i + 1}: Error de base de datos - ${dbError.message}`);
          }
        }
        
      } catch (error: any) {
        result.errors.push(`Fila ${i + 1}: Error procesando venta normalizada - ${error.message}`);
      }
    }
    
    console.log(`✅ NORMALIZADOR ÚNICO: Procesamiento completado - ${result.imported} importadas, ${result.updated} actualizadas, ${result.errors.length} errores`);
    return result;
  }

  // Direct Costs operations
  async getDirectCosts(): Promise<DirectCost[]> {
    return db.select().from(directCosts).orderBy(desc(directCosts.id));
  }

  async getDirectCost(id: number): Promise<DirectCost | undefined> {
    const result = await db.select().from(directCosts).where(eq(directCosts.id, id)).limit(1);
    return result[0];
  }

  async getDirectCostByUniqueKey(uniqueKey: string): Promise<DirectCost | undefined> {
    const result = await db.select()
      .from(directCosts)
      .where(eq(directCosts.uniqueKey, uniqueKey))
      .limit(1);
    return result[0];
  }

  async getDirectCostsByProject(projectId: number): Promise<DirectCost[]> {
    return db.select()
      .from(directCosts)
      .where(eq(directCosts.projectId, projectId))
      .orderBy(desc(directCosts.id));
  }

  async getDirectCostsByPersonnel(personnelId: number): Promise<DirectCost[]> {
    return db.select()
      .from(directCosts)
      .where(eq(directCosts.personnelId, personnelId))
      .orderBy(desc(directCosts.id));
  }

  async createDirectCost(cost: InsertDirectCost): Promise<DirectCost> {
    const result = await db.insert(directCosts).values(cost).returning();
    return result[0];
  }

  async updateDirectCost(id: number, cost: Partial<InsertDirectCost>): Promise<DirectCost | undefined> {
    const result = await db.update(directCosts)
      .set({ ...cost, lastUpdated: new Date() })
      .where(eq(directCosts.id, id))
      .returning();
    return result[0];
  }

  async deleteDirectCost(id: number): Promise<boolean> {
    const result = await db.delete(directCosts).where(eq(directCosts.id, id));
    return (result as any).rowCount > 0;
  }

  async clearDirectCosts(): Promise<boolean> {
    await db.delete(directCosts);
    return true;
  }

  // Personnel lookup by name
  async getPersonnelByName(name: string): Promise<Personnel | undefined> {
    const result = await db.select()
      .from(personnel)
      .where(eq(personnel.name, name))
      .limit(1);
    return result[0];
  }

  // Project activity range for one-shot projects
  async getProjectActivityRange(projectId: number): Promise<{ startPeriod: string; endPeriod: string; isActive: boolean } | null> {
    const costEntries = await db.select()
      .from(directCosts)
      .where(eq(directCosts.projectId, projectId))
      .orderBy(asc(directCosts.año), asc(directCosts.monthKey));
      
    if (costEntries.length === 0) return null;
    
    const firstEntry = costEntries[0];
    const lastEntry = costEntries[costEntries.length - 1];
    
    return {
      startPeriod: `${firstEntry.año}-${firstEntry.monthKey?.split('-')[1] || '01'}`,
      endPeriod: `${lastEntry.año}-${lastEntry.monthKey?.split('-')[1] || '12'}`,
      isActive: new Date() <= new Date(`${lastEntry.año}-${lastEntry.monthKey?.split('-')[1] || '12'}-31`)
    };
  }

  // Income Dashboard operations - Lista registros de ingresos para el dashboard
  async listIncomeRows(filters?: {
    projectId?: number;
    timeFilter?: string;
    clientName?: string;
    revenueType?: string;
    status?: string;
  }): Promise<IncomeRecord[]> {
    try {
      console.log(`💰 INCOME ROWS API called with filters:`, filters);

      // Usar la función auxiliar importada para obtener rango de fechas del filtro temporal

      // Construir query base
      let query = db.select().from(googleSheetsSales);
      const conditions = [];

      // Filtro por proyecto específico - CORRECTED: usar quotation_id -> client mapping
      if (filters?.projectId) {
        console.log(`💰 Looking for project ${filters.projectId} client mapping...`);
        
        // Mapear projectId -> quotation -> client para obtener cliente correcto
        const projectMapping = await db.select({
          clientName: clients.name,
          quotationId: quotations.id
        })
        .from(activeProjects)
        .leftJoin(quotations, eq(activeProjects.quotationId, quotations.id))
        .leftJoin(clients, eq(quotations.clientId, clients.id!))
        .where(eq(activeProjects.id, filters.projectId))
        .limit(1);
        
        if (projectMapping.length > 0) {
          const clientName = projectMapping[0].clientName;
          console.log(`💰 Found client mapping: Project ${filters.projectId} -> Client "${clientName}"`);
          
          // Buscar registros de ventas que coincidan con este cliente (más inclusivo)
          conditions.push(eq(googleSheetsSales.clientName, clientName!));
          console.log(`💰 Applied client filter: ${clientName}`);
          
          // DEBUGGING: Log what we're looking for
          console.log(`💰 DEBUGGING: Looking for sales with client_name='${clientName}' in timeFilter range`);
        } else {
          console.log(`💰 No client mapping found for project ${filters.projectId}`);
        }
      }

      // Filtro temporal - FIXED: Use proper Drizzle ORM filters
      if (filters?.timeFilter && filters.timeFilter !== 'all') {
        const dateRange = getDateRangeForFilter(filters.timeFilter);
        if (dateRange) {
          const startMonthKey = `${dateRange.startDate.getFullYear()}-${String(dateRange.startDate.getMonth() + 1).padStart(2, '0')}`;
          const endMonthKey = `${dateRange.endDate.getFullYear()}-${String(dateRange.endDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Aplicar filtro de rango de meses usando operadores de Drizzle
          conditions.push(
            and(
              sql`${googleSheetsSales.monthKey} >= ${startMonthKey}`,
              sql`${googleSheetsSales.monthKey} <= ${endMonthKey}`
            )
          );
          console.log(`💰 Applied time filter: ${startMonthKey} to ${endMonthKey} (range: ${filters.timeFilter})`);
        } else {
          console.log(`💰 No date range found for timeFilter: ${filters.timeFilter}`);
        }
      } else {
        console.log(`💰 No temporal filter applied (filter: ${filters?.timeFilter})`);
      }

      // Filtros adicionales opcionales
      if (filters?.clientName) {
        conditions.push(eq(googleSheetsSales.clientName, filters.clientName));
      }

      if (filters?.revenueType) {
        conditions.push(eq(googleSheetsSales.revenueType, filters.revenueType));
      }

      if (filters?.status) {
        conditions.push(eq(googleSheetsSales.status, filters.status));
      }

      // Aplicar condiciones si existen
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Ejecutar consulta ordenada
      const salesData = await query.orderBy(desc(googleSheetsSales.year), desc(googleSheetsSales.monthNumber));

      console.log(`💰 Found ${salesData.length} sales records`);

      // Mapear datos al formato IncomeRecord con conversión de moneda dinámica
      const incomeRecords: IncomeRecord[] = [];
      
      for (const sale of salesData) {
        // Determinar si mostrar original ARS o USD
        let amountUsd = 0;
        let originalAmount = 0;
        let currency: 'USD' | 'ARS' = 'USD';
        
        const hasOriginalUsd = sale.amountUsd && parseFloat(sale.amountUsd) > 0;
        const hasOriginalArs = sale.amountLocal && parseFloat(sale.amountLocal) > 0 && sale.currency === 'ARS';
        
        // ✅ CORRECCIÓN: SIEMPRE MOSTRAR VALORES ORIGINALES ARS
        if (hasOriginalArs) {
          // Datos originalmente en ARS - MOSTRAR ARS con conversión USD para cálculos
          const year = sale.year || 2025;
          const month = sale.monthNumber || 1;
          
          try {
            const exchangeRate = await this.getExchangeRateByMonth(year, month);
            const rate = exchangeRate ? parseFloat(exchangeRate.rate as any) : 1300; // fallback to 1300 if no rate found
            
            // CALCULAR USD para cálculos internos pero MOSTRAR ARS original
            amountUsd = parseFloat(sale.amountLocal || '0') / rate;
            originalAmount = parseFloat(sale.amountLocal || '0');  // ✅ MOSTRAR MILLONES ARS
            currency = 'ARS';  // ✅ MOSTRAR COMO ARS ORIGINAL
            
            console.log(`💱 Original ARS shown: ${originalAmount.toLocaleString()} ARS (USD equivalent: ${amountUsd.toFixed(2)} for calculations)`);
          } catch (error) {
            console.warn(`⚠️ Could not get exchange rate for ${year}-${month}, using fallback rate 1300`);
            amountUsd = parseFloat(sale.amountLocal || '0') / 1300;
            originalAmount = parseFloat(sale.amountLocal || '0');  // ✅ MOSTRAR MILLONES ARS
            currency = 'ARS';  // ✅ MOSTRAR COMO ARS ORIGINAL
          }
        } else if (hasOriginalUsd) {
          // Datos que originalmente estaban en USD - mantener USD
          amountUsd = parseFloat(sale.amountUsd || '0');
          originalAmount = parseFloat(sale.amountUsd || '0');
          currency = 'USD';
        }

        // Mapear revenue_type de salesType
        let revenueType: 'fee' | 'project' | 'bonus' = 'fee';
        if (sale.salesType?.toLowerCase().includes('fee')) {
          revenueType = 'fee';
        } else if (sale.salesType?.toLowerCase().includes('one shot') || sale.salesType?.toLowerCase().includes('project')) {
          revenueType = 'project';
        } else if (sale.salesType?.toLowerCase().includes('bonus')) {
          revenueType = 'bonus';
        }

        // Mapear status de los datos del Excel
        let status: 'completada' | 'pendiente' | 'proyectada' = 'completada';
        if (sale.status?.toLowerCase().includes('proyectado') || sale.status?.toLowerCase().includes('projected')) {
          status = 'proyectada';
        } else if (sale.status?.toLowerCase().includes('pendiente') || sale.status?.toLowerCase().includes('pending')) {
          status = 'pendiente';
        } else if (sale.status?.toLowerCase().includes('emitido') || sale.status?.toLowerCase().includes('completada') || sale.status?.toLowerCase().includes('completed')) {
          status = 'completada';
        }

        incomeRecords.push({
          id: sale.id,
          client_name: sale.clientName || '',
          project_name: sale.projectName || '',
          amount_usd: amountUsd,
          original_amount: originalAmount,
          currency: currency,
          month_key: sale.monthKey || '',
          revenue_type: revenueType,
          status: status,
          confirmed: sale.confirmed || 'SI'
        });
      }

      console.log(`💰 Mapped ${incomeRecords.length} income records`);
      console.log(`💰 Sample records:`, incomeRecords.slice(0, 3));

      return incomeRecords;

    } catch (error) {
      console.error("❌ Error in listIncomeRows:", error);
      return [];
    }
  }

  // ==================== DIRECT COSTS METHODS ====================
  
  async getAllDirectCosts(): Promise<any[]> {
    try {
      // Obtener todos los costos directos desde la tabla direct_costs
      const costs = await this.db.select().from(directCosts);
      console.log(`📊 Obtenidos ${costs.length} costos directos desde base de datos`);
      return costs;
    } catch (error) {
      console.error("❌ Error getting all direct costs:", error);
      return [];
    }
  }

  async upsertDirectCost(costData: InsertDirectCost): Promise<{ isNew: boolean; record: DirectCost }> {
    try {
      // Validar datos usando el schema
      const validatedData = insertDirectCostSchema.parse(costData);
      
      // Intentar buscar registro existente por unique_key
      const existing = await this.db
        .select()
        .from(directCosts)
        .where(eq(directCosts.uniqueKey, validatedData.uniqueKey))
        .limit(1);
      
      if (existing.length > 0) {
        // Actualizar registro existente
        const [updated] = await this.db
          .update(directCosts)
          .set({
            ...validatedData,
            lastUpdated: new Date(),
          })
          .where(eq(directCosts.id, existing[0].id))
          .returning();
        
        console.log(`🔄 Actualizado costo directo: ${validatedData.persona} - ${validatedData.proyecto}`);
        return { isNew: false, record: updated };
      } else {
        // Insertar nuevo registro
        const [inserted] = await this.db
          .insert(directCosts)
          .values(validatedData)
          .returning();
        
        console.log(`✅ Insertado nuevo costo directo: ${validatedData.persona} - ${validatedData.proyecto}`);
        return { isNew: true, record: inserted };
      }
    } catch (error) {
      console.error(`❌ Error en upsert direct cost:`, error);
      throw error;
    }
  }

}

// Exportar solo la implementación de base de datos
export const storage = new DatabaseStorage();