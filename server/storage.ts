import {
  type Client, type InsertClient,
  type Role, type InsertRole,
  type Personnel, type InsertPersonnel,
  type ReportTemplate, type InsertReportTemplate,
  type Quotation, type InsertQuotation,
  type QuotationTeamMember, type InsertQuotationTeamMember,
  type TemplateRoleAssignment, type InsertTemplateRoleAssignment,
  type ActiveProject, type InsertActiveProject,
  type ProjectComponent, type InsertProjectComponent,
  type TimeEntry, type InsertTimeEntry,
  type ProgressReport, type InsertProgressReport,
  type User, type InsertUser,
  type Deliverable, type InsertDeliverable,
  type ClientModoComment, type InsertClientModoComment,
  clients, roles, personnel, reportTemplates, quotations, quotationTeamMembers, templateRoleAssignments,
  activeProjects, projectComponents, timeEntries, progressReports, users,
  analysisTypes, projectTypes, mentionsVolumeOptions, countriesCoveredOptions, clientEngagementOptions,
  projectStatusOptions, trackingFrequencyOptions,
  chatConversations, chatMessages, chatConversationParticipants,
  deliverables, clientModoComments
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, ne, and, sql, inArray, desc } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

export interface IStorage {
  // Client operations
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;

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

  // Report template operations
  getReportTemplates(): Promise<ReportTemplate[]>;
  getReportTemplate(id: number): Promise<ReportTemplate | undefined>;
  createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate>;
  updateReportTemplate(id: number, template: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined>;
  deleteReportTemplate(id: number): Promise<boolean>;

  // Template role assignments operations
  getTemplateRoleAssignments(templateId: number): Promise<TemplateRoleAssignment[]>;
  getTemplateRoleAssignmentsWithRoles(templateId: number): Promise<(TemplateRoleAssignment & { role: Role })[]>;
  createTemplateRoleAssignment(assignment: InsertTemplateRoleAssignment): Promise<TemplateRoleAssignment>;
  updateTemplateRoleAssignment(id: number, assignment: Partial<InsertTemplateRoleAssignment>): Promise<TemplateRoleAssignment | undefined>;
  deleteTemplateRoleAssignment(id: number): Promise<boolean>;
  deleteTemplateRoleAssignments(templateId: number): Promise<void>;

  // Quotation operations
  getQuotations(): Promise<Quotation[]>;
  getQuotationsByClient(clientId: number): Promise<Quotation[]>;
  getQuotation(id: number): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  updateQuotationStatus(id: number, status: string): Promise<Quotation | undefined>;
  deleteQuotation(id: number): Promise<boolean>;

  // Quotation team members operations
  getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]>;
  createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember>;
  deleteQuotationTeamMembers(quotationId: number): Promise<void>;
  deleteQuotationTeamMemberById(id: number): Promise<void>;

  // Active project operations
  getActiveProjects(): Promise<ActiveProject[]>;
  getActiveProjectsByClient(clientId: number): Promise<(ActiveProject & { quotation: Quotation })[]>;
  getActiveProject(id: number): Promise<ActiveProject | undefined>;
  createActiveProject(project: InsertActiveProject): Promise<ActiveProject>;
  updateActiveProject(id: number, project: Partial<InsertActiveProject>): Promise<ActiveProject | undefined>;
  getProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]>;
  getActiveProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]>;
  getActiveProjectsByParentId(parentId: number): Promise<ActiveProject[]>;
  deleteActiveProject(id: number): Promise<boolean>;
  
  // Project component operations
  getProjectComponents(projectId: number): Promise<ProjectComponent[]>;
  getProjectComponent(id: number): Promise<ProjectComponent | undefined>;
  createProjectComponent(component: InsertProjectComponent): Promise<ProjectComponent>;
  updateProjectComponent(id: number, component: Partial<InsertProjectComponent>): Promise<ProjectComponent | undefined>;
  deleteProjectComponent(id: number): Promise<boolean>;
  getDefaultProjectComponent(projectId: number): Promise<ProjectComponent | undefined>;
  
  // Time entry operations
  getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]>;
  getTimeEntriesByPersonnel(personnelId: number): Promise<TimeEntry[]>;
  getTimeEntriesByClient(clientId: number): Promise<TimeEntry[]>;
  getTimeEntryById(id: number): Promise<TimeEntry | undefined>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<boolean>;
  approveTimeEntry(id: number, approverId: number): Promise<TimeEntry | undefined>;
  
  // Progress report operations
  getProgressReportsByProject(projectId: number): Promise<ProgressReport[]>;
  getProgressReport(id: number): Promise<ProgressReport | undefined>;
  createProgressReport(report: InsertProgressReport): Promise<ProgressReport>;
  updateProgressReport(id: number, report: Partial<InsertProgressReport>): Promise<ProgressReport | undefined>;
  
  // Financial comparison operations
  getProjectCostSummary(projectId: number): Promise<{
    estimatedCost: number;
    actualCost: number;
    variance: number;
    percentageUsed: number;
  }>;
  
  getClientCostSummary(clientId: number): Promise<{
    totalEstimatedCost: number;
    totalActualCost: number;
    totalVariance: number;
    averagePercentageUsed: number;
    projectCount: number;
    projectsData: Array<{
      projectId: number;
      projectName: string;
      estimatedCost: number;
      actualCost: number;
      variance: number;
      percentageUsed: number;
    }>;
  }>;
  
  // Get option lists
  getAnalysisTypes(): Promise<typeof analysisTypes>;
  getProjectTypes(): Promise<typeof projectTypes>;
  getMentionsVolumeOptions(): Promise<typeof mentionsVolumeOptions>;
  getCountriesCoveredOptions(): Promise<typeof countriesCoveredOptions>;
  getClientEngagementOptions(): Promise<typeof clientEngagementOptions>;
  getProjectStatusOptions(): Promise<typeof projectStatusOptions>;
  getTrackingFrequencyOptions(): Promise<typeof trackingFrequencyOptions>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat operations
  createChatConversation(data: any): Promise<any>;
  getDirectConversation(user1Id: number, user2Id: number): Promise<any | undefined>;
  getChatConversationWithDetails(conversationId: number): Promise<any>;
  getUserConversations(userId: number): Promise<any[]>;
  getChatMessages(conversationId: number): Promise<any[]>;
  createChatMessage(data: any): Promise<any>;
  addConversationParticipant(data: any): Promise<any>;
  getConversationParticipants(conversationId: number): Promise<any[]>;
  isConversationParticipant(conversationId: number, userId: number): Promise<boolean>;
  updateConversationLastActivity(conversationId: number): Promise<void>;
  markConversationMessagesAsSeen(conversationId: number, userId: number): Promise<void>;
  
  // Session store
  sessionStore: session.Store;
  
  // MODO operations
  getDeliverables(clientId?: number): Promise<Deliverable[]>;
  getDeliverable(id: number): Promise<Deliverable | undefined>;
  createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable>;
  updateDeliverable(id: number, deliverable: Partial<InsertDeliverable>): Promise<Deliverable | undefined>;
  deleteDeliverable(id: number): Promise<boolean>;
  
  getClientModoComments(clientId: number): Promise<ClientModoComment[]>;
  getClientModoComment(id: number): Promise<ClientModoComment | undefined>;
  getClientModoCommentByQuarter(clientId: number, quarter: number, year: number): Promise<ClientModoComment | undefined>;
  createClientModoComment(comment: InsertClientModoComment): Promise<ClientModoComment>;
  updateClientModoComment(id: number, comment: Partial<InsertClientModoComment>): Promise<ClientModoComment | undefined>;
  deleteClientModoComment(id: number): Promise<boolean>;
  
  // MODO analytics
  getClientModoSummary(clientId: number): Promise<{
    totalDeliverables: number;
    onTimeDeliveries: number;
    onTimePercentage: number;
    averageScores: {
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
}

export class MemStorage implements IStorage {
  sessionStore: session.Store;
  
  private clients: Map<number, Client>;
  private roles: Map<number, Role>;
  private personnel: Map<number, Personnel>;
  private reportTemplates: Map<number, ReportTemplate>;
  private quotations: Map<number, Quotation>;
  private quotationTeamMembers: Map<number, QuotationTeamMember>;
  private templateRoleAssignments: Map<number, TemplateRoleAssignment>;
  private activeProjects: Map<number, ActiveProject>;
  private projectComponents: Map<number, ProjectComponent>;
  private timeEntries: Map<number, TimeEntry>;
  private progressReports: Map<number, ProgressReport>;
  
  private clientId: number;
  private roleId: number;
  private personnelId: number;
  private templateId: number;
  private quotationId: number;
  private quotationTeamMemberId: number;
  private templateRoleAssignmentId: number;
  private activeProjectId: number;
  private timeEntryId: number;
  private progressReportId: number;

  constructor() {
    // Usar PostgreSQL para almacenamiento persistente de sesiones
    const PgStore = require('connect-pg-simple')(session);
    this.sessionStore = new PgStore({
      pool, // Usar la conexión de pool existente desde db.ts
      tableName: 'sessions', // Tabla para almacenar sesiones
      createTableIfMissing: true, // Crear la tabla si no existe
      pruneSessionInterval: 3600, // Limpiar sesiones expiradas cada hora
      // Configuración para alta disponibilidad y persistencia
      disableTouch: false, // Actualizar fecha de expiración con cada request
      errorLog: (err) => console.error('Error en PgSessionStore:', err)
    });
    this.clients = new Map();
    this.roles = new Map();
    this.personnel = new Map();
    this.reportTemplates = new Map();
    this.quotations = new Map();
    this.quotationTeamMembers = new Map();
    this.templateRoleAssignments = new Map();
    this.activeProjects = new Map();
    this.timeEntries = new Map();
    this.progressReports = new Map();
    
    this.clientId = 1;
    this.roleId = 1;
    this.personnelId = 1;
    this.templateId = 1;
    this.quotationId = 1;
    this.quotationTeamMemberId = 1;
    this.templateRoleAssignmentId = 1;
    this.activeProjectId = 1;
    this.timeEntryId = 1;
    this.progressReportId = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Add sample roles
    const seniorAnalyst = this.createRole({ name: "Senior Analyst", description: "Provides expertise in analyzing complex social data and creating strategic insights.", defaultRate: 85 });
    const dataScientist = this.createRole({ name: "Data Scientist", description: "Develops custom metrics and advanced data modeling for deeper insights.", defaultRate: 95 });
    const contentSpecialist = this.createRole({ name: "Content Specialist", description: "Creates engaging visualizations and narrative for report presentation.", defaultRate: 75 });
    const projectManager = this.createRole({ name: "Project Manager", description: "Oversees project delivery and client communication.", defaultRate: 80 });

    // Add sample personnel
    this.createPersonnel({ name: "John Davis", roleId: seniorAnalyst.id, hourlyRate: 85 });
    this.createPersonnel({ name: "Sarah Miller", roleId: seniorAnalyst.id, hourlyRate: 90 });
    this.createPersonnel({ name: "Michael Wong", roleId: seniorAnalyst.id, hourlyRate: 85 });
    this.createPersonnel({ name: "Alex Chen", roleId: dataScientist.id, hourlyRate: 95 });
    this.createPersonnel({ name: "Emma Rodriguez", roleId: dataScientist.id, hourlyRate: 100 });
    this.createPersonnel({ name: "Rachel Kim", roleId: contentSpecialist.id, hourlyRate: 75 });
    this.createPersonnel({ name: "Jason Thompson", roleId: contentSpecialist.id, hourlyRate: 80 });
    this.createPersonnel({ name: "David Johnson", roleId: projectManager.id, hourlyRate: 80 });

    // Add sample clients
    this.createClient({ name: "Acme Corporation", contactName: "Jane Doe", contactEmail: "jane@acmecorp.com", contactPhone: "+1-555-123-4567" });
    this.createClient({ name: "TechStart Inc.", contactName: "John Smith", contactEmail: "john@techstart.com", contactPhone: "+1-555-987-6543" });
    this.createClient({ name: "Global Media Group", contactName: "Emily Wilson", contactEmail: "emily@globalmedia.com", contactPhone: "+1-555-456-7890" });

    // Add sample report templates
    const panelEjecutivo = this.createReportTemplate({
      name: "Panel Ejecutivo",
      description: "Métricas concisas de alto nivel con ideas clave y recomendaciones estratégicas. Ideal para directivos.",
      complexity: "low",
      pageRange: "5-10 páginas",
      features: "Métricas principales"
    });
    
    const analisisCompleto = this.createReportTemplate({
      name: "Análisis Completo",
      description: "Evaluación detallada con métricas extensas, segmentación de audiencia y desglose demográfico.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Métricas avanzadas"
    });
    
    const rendimientoCampana = this.createReportTemplate({
      name: "Rendimiento de Campaña",
      description: "Análisis previo, durante y posterior a la campaña con seguimiento de KPI y datos comparativos de referencia.",
      complexity: "high",
      pageRange: "20-30 páginas",
      features: "Análisis de tendencias"
    });
    
    const plantillaPersonalizada = this.createReportTemplate({
      name: "Plantilla Personalizada",
      description: "Estructura de informe personalizada basada en requisitos específicos del cliente y objetivos del proyecto.",
      complexity: "variable",
      pageRange: "Longitud variable",
      features: "Métricas personalizadas"
    });
    
    const informeCrisis = this.createReportTemplate({
      name: "Informe de Crisis",
      description: "Monitoreo intensivo y análisis de situaciones críticas que requieren respuesta inmediata.",
      complexity: "high",
      pageRange: "10-20 páginas",
      features: "Alertas y recomendaciones"
    });
    
    const informePrecios = this.createReportTemplate({
      name: "Informe de Precios",
      description: "Análisis comparativo de precios del mercado con identificación de oportunidades y riesgos.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Análisis competitivo"
    });
    
    const analisisConversacion = this.createReportTemplate({
      name: "Análisis de Conversación Digital",
      description: "Estudio profundo de conversaciones en redes sociales con análisis de sentimiento y temas emergentes.",
      complexity: "high",
      pageRange: "20-30 páginas",
      features: "Análisis semántico"
    });
    
    const informeMensual = this.createReportTemplate({
      name: "Informe Mensual",
      description: "Resumen periódico de KPIs principales, tendencias del mes y recomendaciones tácticas.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Comparativa mensual"
    });
    
    const informeSemanal = this.createReportTemplate({
      name: "Informe Semanal",
      description: "Actualización rápida con datos clave de la semana y alertas de cambios significativos.",
      complexity: "low",
      pageRange: "5-10 páginas",
      features: "Métricas ágiles"
    });
    
    const informeSOV = this.createReportTemplate({
      name: "Informe SOV (Share of Voice)",
      description: "Análisis de la cuota de conversación de la marca respecto a competidores en canales digitales.",
      complexity: "medium",
      pageRange: "10-20 páginas",
      features: "Visualización comparativa"
    });

    // Add sample template role assignments
    
    // Panel Ejecutivo - Informe básico y corto
    this.createTemplateRoleAssignment({
      templateId: panelEjecutivo.id,
      roleId: seniorAnalyst.id,
      hours: "6"
    });
    this.createTemplateRoleAssignment({
      templateId: panelEjecutivo.id,
      roleId: contentSpecialist.id,
      hours: "4"
    });
    this.createTemplateRoleAssignment({
      templateId: panelEjecutivo.id,
      roleId: projectManager.id,
      hours: "2"
    });
    
    // Análisis Completo - Informe detallado con análisis profundo
    this.createTemplateRoleAssignment({
      templateId: analisisCompleto.id,
      roleId: seniorAnalyst.id,
      hours: "12"
    });
    this.createTemplateRoleAssignment({
      templateId: analisisCompleto.id,
      roleId: dataScientist.id,
      hours: "8"
    });
    this.createTemplateRoleAssignment({
      templateId: analisisCompleto.id,
      roleId: contentSpecialist.id,
      hours: "10"
    });
    this.createTemplateRoleAssignment({
      templateId: analisisCompleto.id,
      roleId: projectManager.id,
      hours: "6"
    });
    
    // Rendimiento de Campaña - Análisis extenso antes, durante y después de campaña
    this.createTemplateRoleAssignment({
      templateId: rendimientoCampana.id,
      roleId: seniorAnalyst.id,
      hours: "15"
    });
    this.createTemplateRoleAssignment({
      templateId: rendimientoCampana.id,
      roleId: dataScientist.id,
      hours: "10"
    });
    this.createTemplateRoleAssignment({
      templateId: rendimientoCampana.id,
      roleId: contentSpecialist.id,
      hours: "12"
    });
    this.createTemplateRoleAssignment({
      templateId: rendimientoCampana.id,
      roleId: projectManager.id,
      hours: "8"
    });
    
    // Informe de Crisis - Monitoreo intensivo y alerta temprana
    this.createTemplateRoleAssignment({
      templateId: informeCrisis.id,
      roleId: seniorAnalyst.id,
      hours: "20"
    });
    this.createTemplateRoleAssignment({
      templateId: informeCrisis.id,
      roleId: dataScientist.id,
      hours: "10"
    });
    this.createTemplateRoleAssignment({
      templateId: informeCrisis.id,
      roleId: contentSpecialist.id,
      hours: "8"
    });
    this.createTemplateRoleAssignment({
      templateId: informeCrisis.id,
      roleId: projectManager.id,
      hours: "12"
    });
    
    // Análisis de Conversación Digital - Análisis semántico complejo
    this.createTemplateRoleAssignment({
      templateId: analisisConversacion.id,
      roleId: seniorAnalyst.id,
      hours: "18"
    });
    this.createTemplateRoleAssignment({
      templateId: analisisConversacion.id,
      roleId: dataScientist.id,
      hours: "15"
    });
    this.createTemplateRoleAssignment({
      templateId: analisisConversacion.id,
      roleId: contentSpecialist.id,
      hours: "10"
    });
    this.createTemplateRoleAssignment({
      templateId: analisisConversacion.id,
      roleId: projectManager.id,
      hours: "8"
    });
    
    // Informe Mensual - Actualización periódica con tendencias
    this.createTemplateRoleAssignment({
      templateId: informeMensual.id,
      roleId: seniorAnalyst.id,
      hours: "8"
    });
    this.createTemplateRoleAssignment({
      templateId: informeMensual.id,
      roleId: contentSpecialist.id,
      hours: "6"
    });
    this.createTemplateRoleAssignment({
      templateId: informeMensual.id,
      roleId: projectManager.id,
      hours: "4"
    });
    
    // Informe Semanal - Actualizaciones rápidas
    this.createTemplateRoleAssignment({
      templateId: informeSemanal.id,
      roleId: seniorAnalyst.id,
      hours: "3"
    });
    this.createTemplateRoleAssignment({
      templateId: informeSemanal.id,
      roleId: contentSpecialist.id,
      hours: "2"
    });
    this.createTemplateRoleAssignment({
      templateId: informeSemanal.id,
      roleId: projectManager.id,
      hours: "1"
    });
    
    // Informe SOV - Análisis de cuota de voz
    this.createTemplateRoleAssignment({
      templateId: informeSOV.id,
      roleId: seniorAnalyst.id,
      hours: "10"
    });
    this.createTemplateRoleAssignment({
      templateId: informeSOV.id,
      roleId: dataScientist.id,
      hours: "6"
    });
    this.createTemplateRoleAssignment({
      templateId: informeSOV.id,
      roleId: contentSpecialist.id,
      hours: "8"
    });
    this.createTemplateRoleAssignment({
      templateId: informeSOV.id,
      roleId: projectManager.id,
      hours: "5"
    });
  }

  // Client operations
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const id = this.clientId++;
    const newClient: Client = { ...client, id };
    this.clients.set(id, newClient);
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    const existingClient = this.clients.get(id);
    if (!existingClient) return undefined;
    
    const updatedClient = { ...existingClient, ...client };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  // Role operations
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  async getRole(id: number): Promise<Role | undefined> {
    return this.roles.get(id);
  }

  async createRole(role: InsertRole): Promise<Role> {
    const id = this.roleId++;
    const newRole: Role = { ...role, id };
    this.roles.set(id, newRole);
    return newRole;
  }

  async updateRole(id: number, role: Partial<InsertRole>): Promise<Role | undefined> {
    const existingRole = this.roles.get(id);
    if (!existingRole) return undefined;
    
    const updatedRole = { ...existingRole, ...role };
    this.roles.set(id, updatedRole);
    return updatedRole;
  }
  
  async deleteRole(id: number): Promise<boolean> {
    // Primero verificar si hay personal asociado a este rol
    const personnelWithRole = await this.getPersonnelByRole(id);
    if (personnelWithRole.length > 0) {
      // No podemos eliminar un rol que tenga personal asociado
      return false;
    }
    
    const result = this.roles.delete(id);
    return result;
  }

  // Personnel operations
  async getPersonnel(): Promise<Personnel[]> {
    return Array.from(this.personnel.values());
  }

  async getPersonnelByRole(roleId: number): Promise<Personnel[]> {
    return Array.from(this.personnel.values()).filter(p => p.roleId === roleId);
  }

  async getPersonnelById(id: number): Promise<Personnel | undefined> {
    return this.personnel.get(id);
  }

  async createPersonnel(personnel: InsertPersonnel): Promise<Personnel> {
    const id = this.personnelId++;
    const newPersonnel: Personnel = { ...personnel, id };
    this.personnel.set(id, newPersonnel);
    return newPersonnel;
  }

  async updatePersonnel(id: number, personnel: Partial<InsertPersonnel>): Promise<Personnel | undefined> {
    const existingPersonnel = this.personnel.get(id);
    if (!existingPersonnel) return undefined;
    
    const updatedPersonnel = { ...existingPersonnel, ...personnel };
    this.personnel.set(id, updatedPersonnel);
    return updatedPersonnel;
  }

  // Report template operations
  async getReportTemplates(): Promise<ReportTemplate[]> {
    return Array.from(this.reportTemplates.values());
  }

  async getReportTemplate(id: number): Promise<ReportTemplate | undefined> {
    return this.reportTemplates.get(id);
  }

  async createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate> {
    const id = this.templateId++;
    const newTemplate: ReportTemplate = { ...template, id };
    this.reportTemplates.set(id, newTemplate);
    return newTemplate;
  }

  async updateReportTemplate(id: number, template: Partial<InsertReportTemplate>): Promise<ReportTemplate | undefined> {
    const existingTemplate = this.reportTemplates.get(id);
    if (!existingTemplate) return undefined;
    
    const updatedTemplate = { ...existingTemplate, ...template };
    this.reportTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }
  
  async deleteReportTemplate(id: number): Promise<boolean> {
    // Primero eliminar todas las asignaciones de roles asociadas a esta plantilla
    await this.deleteTemplateRoleAssignments(id);
    
    // Verificar si la plantilla existe
    if (!this.reportTemplates.has(id)) {
      return false;
    }
    
    // Eliminar la plantilla
    return this.reportTemplates.delete(id);
  }

  // Quotation operations
  async getQuotations(): Promise<Quotation[]> {
    return Array.from(this.quotations.values());
  }

  async getQuotationsByClient(clientId: number): Promise<Quotation[]> {
    return Array.from(this.quotations.values()).filter(q => q.clientId === clientId);
  }

  async getQuotation(id: number): Promise<Quotation | undefined> {
    return this.quotations.get(id);
  }

  async createQuotation(quotation: InsertQuotation): Promise<Quotation> {
    const id = this.quotationId++;
    const now = new Date();
    
    const newQuotation: Quotation = {
      ...quotation,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.quotations.set(id, newQuotation);
    return newQuotation;
  }

  async updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined> {
    const existingQuotation = this.quotations.get(id);
    if (!existingQuotation) return undefined;
    
    const updatedQuotation = {
      ...existingQuotation,
      ...quotation,
      updatedAt: new Date()
    };
    
    this.quotations.set(id, updatedQuotation);
    return updatedQuotation;
  }

  async updateQuotationStatus(id: number, status: string): Promise<Quotation | undefined> {
    const existingQuotation = this.quotations.get(id);
    if (!existingQuotation) return undefined;
    
    const updatedQuotation = {
      ...existingQuotation,
      status,
      updatedAt: new Date()
    };
    
    this.quotations.set(id, updatedQuotation);
    return updatedQuotation;
  }

  // Quotation team members operations
  async getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]> {
    return Array.from(this.quotationTeamMembers.values()).filter(q => q.quotationId === quotationId);
  }

  async createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember> {
    const id = this.quotationTeamMemberId++;
    const newMember: QuotationTeamMember = { ...member, id };
    this.quotationTeamMembers.set(id, newMember);
    return newMember;
  }

  async deleteQuotationTeamMembers(quotationId: number): Promise<void> {
    for (const [id, member] of this.quotationTeamMembers.entries()) {
      if (member.quotationId === quotationId) {
        this.quotationTeamMembers.delete(id);
      }
    }
  }
  
  async deleteQuotationTeamMemberById(id: number): Promise<void> {
    this.quotationTeamMembers.delete(id);
  }

  // Template role assignments operations
  async getTemplateRoleAssignments(templateId: number): Promise<TemplateRoleAssignment[]> {
    return Array.from(this.templateRoleAssignments.values()).filter(
      (a) => a.templateId === templateId
    );
  }

  async getTemplateRoleAssignmentsWithRoles(templateId: number): Promise<(TemplateRoleAssignment & { role: Role })[]> {
    const assignments = await this.getTemplateRoleAssignments(templateId);
    return Promise.all(
      assignments.map(async (assignment) => {
        const role = await this.getRole(assignment.roleId);
        return {
          ...assignment,
          role: role!
        };
      })
    );
  }

  async createTemplateRoleAssignment(assignment: InsertTemplateRoleAssignment): Promise<TemplateRoleAssignment> {
    const id = this.templateRoleAssignmentId++;
    const newAssignment: TemplateRoleAssignment = { ...assignment, id };
    this.templateRoleAssignments.set(id, newAssignment);
    return newAssignment;
  }

  async updateTemplateRoleAssignment(id: number, assignment: Partial<InsertTemplateRoleAssignment>): Promise<TemplateRoleAssignment | undefined> {
    const existingAssignment = this.templateRoleAssignments.get(id);
    if (!existingAssignment) return undefined;
    
    const updatedAssignment = { ...existingAssignment, ...assignment };
    this.templateRoleAssignments.set(id, updatedAssignment);
    return updatedAssignment;
  }

  async deleteTemplateRoleAssignment(id: number): Promise<boolean> {
    return this.templateRoleAssignments.delete(id);
  }

  async deleteTemplateRoleAssignments(templateId: number): Promise<void> {
    for (const [id, assignment] of this.templateRoleAssignments.entries()) {
      if (assignment.templateId === templateId) {
        this.templateRoleAssignments.delete(id);
      }
    }
  }

  // Get option lists
  async getAnalysisTypes() {
    return analysisTypes;
  }

  async getProjectTypes() {
    return projectTypes;
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
}

// Implementación de la base de datos
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Crear store para sesiones usando PostgreSQL con configuración optimizada para alta disponibilidad
    const PgStore = connectPgSimple(session);
    this.sessionStore = new PgStore({
      pool,
      tableName: 'sessions', // Estandarizado a 'sessions' con 's' para consistencia
      createTableIfMissing: true,
      // Configuración crítica para asegurar persistencia extrema
      pruneSessionInterval: 86400, // Limpiar solo una vez al día (cada 24 horas)
      errorLog: (err) => {
        console.error('ERROR CRÍTICO EN SESSION STORE:', err);
        // Registrar errores críticos para solucionar problemas rápidamente
      },
      // Configuración para operaciones prolongadas y formas intensivas
      disableTouch: false, // Actualizar consistentemente la fecha de expiración
      ttl: 60 * 60 * 24 * 180, // 180 días (6 meses) para máxima persistencia
    });
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
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }
  
  // Chat operations
  async createChatConversation(data: any): Promise<any> {
    const result = await db.insert(chatConversations).values(data).returning();
    return result[0];
  }
  
  async getDirectConversation(user1Id: number, user2Id: number): Promise<any | undefined> {
    // Buscar conversaciones 1:1 (no grupales) donde participen los dos usuarios
    const participants = await db
      .select()
      .from(chatConversationParticipants)
      .innerJoin(
        chatConversations,
        eq(chatConversationParticipants.conversationId, chatConversations.id)
      )
      .where(
        and(
          eq(chatConversations.isGroup, false),
          eq(chatConversationParticipants.userId, user1Id)
        )
      );
    
    if (!participants.length) return undefined;
    
    // Obtener IDs de esas conversaciones
    const conversationIds = participants.map(p => p.chat_conversation_participants.conversationId);
    
    // Buscar si el usuario 2 participa en alguna de esas conversaciones
    const conversations = await db
      .select()
      .from(chatConversationParticipants)
      .where(
        and(
          inArray(chatConversationParticipants.conversationId, conversationIds),
          eq(chatConversationParticipants.userId, user2Id)
        )
      );
    
    if (!conversations.length) return undefined;
    
    // Obtener la primera conversación que coincida
    const conversationId = conversations[0].conversationId;
    const conversation = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId));
    
    return conversation[0];
  }
  
  async getChatConversationWithDetails(conversationId: number): Promise<any> {
    // Obtener la conversación
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId));
    
    if (!conversation) return null;
    
    // Obtener participantes
    const participants = await db
      .select({
        id: chatConversationParticipants.id,
        userId: chatConversationParticipants.userId,
        conversationId: chatConversationParticipants.conversationId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
      })
      .from(chatConversationParticipants)
      .innerJoin(users, eq(chatConversationParticipants.userId, users.id))
      .where(eq(chatConversationParticipants.conversationId, conversationId));
    
    // Obtener mensajes recientes
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(sql`${chatMessages.createdAt} DESC`)
      .limit(20);
    
    return {
      ...conversation,
      participants,
      messages: messages.reverse(),
    };
  }
  
  async getUserConversations(userId: number): Promise<any[]> {
    // Obtener IDs de conversaciones donde el usuario participa
    const participations = await db
      .select()
      .from(chatConversationParticipants)
      .where(eq(chatConversationParticipants.userId, userId));
    
    if (!participations.length) return [];
    
    const conversationIds = participations.map(p => p.conversationId);
    
    // Obtener las conversaciones con detalles básicos
    const conversations = await db
      .select()
      .from(chatConversations)
      .where(inArray(chatConversations.id, conversationIds))
      .orderBy(sql`${chatConversations.lastMessageAt} DESC`);
    
    // Para cada conversación, obtener participantes
    const result = [];
    
    for (const conversation of conversations) {
      const participants = await db
        .select({
          id: chatConversationParticipants.id,
          userId: chatConversationParticipants.userId,
          conversationId: chatConversationParticipants.conversationId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          avatar: users.avatar,
        })
        .from(chatConversationParticipants)
        .innerJoin(users, eq(chatConversationParticipants.userId, users.id))
        .where(eq(chatConversationParticipants.conversationId, conversation.id));
      
      // Obtener último mensaje
      const [lastMessage] = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversation.id))
        .orderBy(sql`${chatMessages.createdAt} DESC`)
        .limit(1);
      
      result.push({
        ...conversation,
        participants,
        lastMessage,
      });
    }
    
    return result;
  }
  
  async getChatMessages(conversationId: number): Promise<any[]> {
    const messages = await db
      .select({
        id: chatMessages.id,
        conversationId: chatMessages.conversationId,
        senderId: chatMessages.senderId,
        content: chatMessages.content,
        imageUrl: chatMessages.imageUrl,
        createdAt: chatMessages.createdAt,
        seen: chatMessages.seen,
        senderFirstName: users.firstName,
        senderLastName: users.lastName,
        senderAvatar: users.avatar,
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(sql`${chatMessages.createdAt} ASC`);
    
    return messages;
  }
  
  async createChatMessage(data: any): Promise<any> {
    const result = await db.insert(chatMessages).values(data).returning();
    return result[0];
  }
  
  async addConversationParticipant(data: any): Promise<any> {
    const result = await db.insert(chatConversationParticipants).values(data).returning();
    return result[0];
  }
  
  async getConversationParticipants(conversationId: number): Promise<any[]> {
    return await db
      .select()
      .from(chatConversationParticipants)
      .where(eq(chatConversationParticipants.conversationId, conversationId));
  }
  
  async isConversationParticipant(conversationId: number, userId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(chatConversationParticipants)
      .where(
        and(
          eq(chatConversationParticipants.conversationId, conversationId),
          eq(chatConversationParticipants.userId, userId)
        )
      );
    
    return result.length > 0;
  }
  
  async updateConversationLastActivity(conversationId: number): Promise<void> {
    await db
      .update(chatConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));
  }
  
  async markConversationMessagesAsSeen(conversationId: number, userId: number): Promise<void> {
    // Utilizar SQL raw para simplificar la operación
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

  // Client operations
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    try {
      console.log("DatabaseStorage.updateClient: Actualizando cliente con ID:", id);
      console.log("DatabaseStorage.updateClient: Datos a actualizar:", client);
      
      // Verificar primero si el cliente existe
      const existingClient = await this.getClient(id);
      if (!existingClient) {
        console.log("DatabaseStorage.updateClient: Cliente no encontrado con ID:", id);
        return undefined;
      }
      
      // Realizar la actualización
      const [updatedClient] = await db
        .update(clients)
        .set(client)
        .where(eq(clients.id, id))
        .returning();
      
      console.log("DatabaseStorage.updateClient: Cliente actualizado:", updatedClient);
      return updatedClient;
    } catch (error) {
      console.error("DatabaseStorage.updateClient: Error al actualizar cliente:", error);
      throw error;
    }
  }

  // Role operations
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles);
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
    // Verificar primero si hay personal asociado a este rol
    const personnelWithRole = await this.getPersonnelByRole(id);
    if (personnelWithRole.length > 0) {
      // No podemos eliminar un rol que tenga personal asociado
      return false;
    }
    
    // Si no hay personal asociado, eliminar el rol
    await db.delete(roles).where(eq(roles.id, id));
    // Verificar si el rol todavía existe
    const roleExists = await this.getRole(id);
    return !roleExists;
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
    const [newPersonnel] = await db.insert(personnel).values(person).returning();
    return newPersonnel;
  }

  async updatePersonnel(id: number, person: Partial<InsertPersonnel>): Promise<Personnel | undefined> {
    const [updatedPersonnel] = await db
      .update(personnel)
      .set(person)
      .where(eq(personnel.id, id))
      .returning();
    return updatedPersonnel;
  }

  // Report template operations
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
    await this.deleteTemplateRoleAssignments(id);
    
    // Por ahora, simplemente procedemos con la eliminación de la plantilla
    // ya que aún no tenemos quotations con templates asociados
    
    // Eliminar la plantilla
    await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
    
    // Verificar si la plantilla fue eliminada
    const [template] = await db
      .select()
      .from(reportTemplates)
      .where(eq(reportTemplates.id, id));
      
    return !template;
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
      .set({ ...quotation, updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();
    return updatedQuotation;
  }

  async updateQuotationStatus(id: number, status: string): Promise<Quotation | undefined> {
    const [updatedQuotation] = await db
      .update(quotations)
      .set({ status, updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();
    return updatedQuotation;
  }
  
  async deleteQuotation(id: number): Promise<boolean> {
    try {
      console.log(`[DEBUG] Iniciando eliminación de cotización ID ${id}`);
      
      // 1. Verificar que la cotización exista
      const quotation = await this.getQuotation(id);
      console.log(`[DEBUG] Cotización encontrada:`, quotation ? 'Sí' : 'No');
      
      if (!quotation) {
        console.log(`Cotización con ID ${id} no encontrada para eliminar`);
        return false;
      }
      
      // 2. Verificar si la cotización está asociada a algún proyecto activo
      const activeProjects = await this.getActiveProjectsByQuotationId(id);
      console.log(`[DEBUG] Proyectos activos asociados: ${activeProjects.length}`);
      console.log(`[DEBUG] IDs de proyectos activos:`, activeProjects.map(p => p.id));
      
      if (activeProjects.length > 0) {
        console.log(`No se puede eliminar la cotización ID ${id} porque está asociada a ${activeProjects.length} proyectos activos`);
        return false;
      }
      
      console.log(`[DEBUG] Eliminando miembros del equipo de cotización`);
      // 3. Eliminar los miembros del equipo de cotización asociados
      await this.deleteQuotationTeamMembers(id);
      
      console.log(`[DEBUG] Eliminando la cotización de la base de datos`);
      // 4. Eliminar la cotización
      await db.delete(quotations).where(eq(quotations.id, id));
      
      // 5. Verificar que la cotización haya sido eliminada
      const checkQuotation = await this.getQuotation(id);
      console.log(`[DEBUG] Verificación final - Cotización aún existe:`, checkQuotation ? 'Sí' : 'No');
      
      return checkQuotation === undefined;
    } catch (error) {
      console.error(`Error al eliminar la cotización ID ${id}:`, error);
      return false;
    }
  }

  // Quotation team members operations
  async getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]> {
    return await db.select().from(quotationTeamMembers).where(eq(quotationTeamMembers.quotationId, quotationId));
  }

  async createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember> {
    const [newMember] = await db.insert(quotationTeamMembers).values(member).returning();
    return newMember;
  }

  async deleteQuotationTeamMembers(quotationId: number): Promise<void> {
    await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.quotationId, quotationId));
  }
  
  async deleteQuotationTeamMemberById(id: number): Promise<void> {
    await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.id, id));
  }

  // Template role assignments operations
  async getTemplateRoleAssignments(templateId: number): Promise<TemplateRoleAssignment[]> {
    return await db.select().from(templateRoleAssignments).where(eq(templateRoleAssignments.templateId, templateId));
  }

  async getTemplateRoleAssignmentsWithRoles(templateId: number): Promise<(TemplateRoleAssignment & { role: Role })[]> {
    const result = await db
      .select({
        assignment: templateRoleAssignments,
        role: roles
      })
      .from(templateRoleAssignments)
      .innerJoin(roles, eq(templateRoleAssignments.roleId, roles.id))
      .where(eq(templateRoleAssignments.templateId, templateId));

    return result.map(item => ({
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

  // Get option lists
  async getAnalysisTypes() {
    return analysisTypes;
  }

  async getProjectTypes() {
    return projectTypes;
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
    const results = await db.select({
      project: activeProjects,
      quotation: quotations,
      client: clients
    })
    .from(activeProjects)
    .innerJoin(quotations, eq(activeProjects.quotationId, quotations.id))
    .leftJoin(clients, eq(quotations.clientId, clients.id))
    .where(eq(activeProjects.id, id));
    
    if (results.length === 0) return undefined;
    
    return {
      ...results[0].project,
      quotation: {
        ...results[0].quotation,
        client: results[0].client || undefined
      }
    };
  }
  
  async createActiveProject(project: InsertActiveProject): Promise<ActiveProject> {
    const [newProject] = await db.insert(activeProjects).values(project).returning();
    return newProject;
  }
  
  async updateActiveProject(id: number, project: Partial<InsertActiveProject>): Promise<ActiveProject | undefined> {
    const [updatedProject] = await db
      .update(activeProjects)
      .set({
        ...project,
        updatedAt: new Date()
      })
      .where(eq(activeProjects.id, id))
      .returning();
    return updatedProject;
  }
  
  async getProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]> {
    return await db
      .select()
      .from(activeProjects)
      .where(eq(activeProjects.quotationId, quotationId));
  }
  
  async getActiveProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]> {
    console.log(`[DEBUG] Buscando proyectos activos para la cotización ID ${quotationId}`);
    const projects = await db
      .select()
      .from(activeProjects)
      .where(eq(activeProjects.quotationId, quotationId));
    
    console.log(`[DEBUG] Proyectos encontrados para cotización ${quotationId}:`, projects.length);
    if (projects.length > 0) {
      console.log(`[DEBUG] IDs de los proyectos encontrados:`, projects.map(p => p.id));
    }
    
    return projects;
  }
  
  async getActiveProjectsByParentId(parentId: number): Promise<(ActiveProject & { quotation?: Quotation & { client?: Client } })[]> {
    console.log(`[DEBUG] Buscando subproyectos para el proyecto padre ID ${parentId}`);
    
    const results = await db.select({
      project: activeProjects,
      quotation: quotations,
      client: clients
    })
    .from(activeProjects)
    .innerJoin(quotations, eq(activeProjects.quotationId, quotations.id))
    .leftJoin(clients, eq(quotations.clientId, clients.id))
    .where(eq(activeProjects.parentProjectId, parentId));
    
    console.log(`[DEBUG] Subproyectos encontrados para proyecto padre ${parentId}:`, results.length);
    
    return results.map(result => ({
      ...result.project,
      quotation: {
        ...result.quotation,
        client: result.client || undefined
      }
    }));
  }
  
  async deleteActiveProject(id: number): Promise<boolean> {
    try {
      // 1. Verificar que el proyecto exista
      const project = await this.getActiveProject(id);
      if (!project) {
        console.log(`Proyecto con ID ${id} no encontrado para eliminar`);
        return false;
      }
      
      console.log(`Eliminando proyecto ID ${id}...`);
      
      // Usar SQL directo para asegurar la eliminación correcta
      try {
        // 1. Eliminar conversaciones de chat relacionadas con el proyecto
        const chatDeleteQuery = `DELETE FROM chat_conversations WHERE project_id = $1`;
        await pool.query(chatDeleteQuery, [id]);
        console.log(`Conversaciones de chat eliminadas para el proyecto ${id}`);
        
        // 2. Eliminar entradas de tiempo
        const timeDeleteQuery = `DELETE FROM time_entries WHERE project_id = $1`;
        await pool.query(timeDeleteQuery, [id]);
        console.log(`Entradas de tiempo eliminadas para el proyecto ${id}`);
        
        // 3. Eliminar informes de progreso
        const progressDeleteQuery = `DELETE FROM progress_reports WHERE project_id = $1`;
        await pool.query(progressDeleteQuery, [id]);
        console.log(`Informes de progreso eliminados para el proyecto ${id}`);
        
        // 4. Eliminar componentes del proyecto
        const componentsDeleteQuery = `DELETE FROM project_components WHERE project_id = $1`;
        await pool.query(componentsDeleteQuery, [id]);
        console.log(`Componentes eliminados para el proyecto ${id}`);
        
        // 5. Finalmente eliminar el proyecto
        const projectDeleteQuery = `DELETE FROM active_projects WHERE id = $1`;
        const result = await pool.query(projectDeleteQuery, [id]);
        console.log(`Resultado de eliminación SQL: ${result.rowCount} fila(s) eliminada(s)`);
        
        return result.rowCount > 0;
      } catch (sqlError) {
        console.error("Error SQL al eliminar el proyecto:", sqlError);
        throw sqlError;
      }
    } catch (error) {
      console.error("Error al eliminar el proyecto activo:", error);
      return false;
    }
  }
  
  // Time entry operations
  async getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).where(eq(timeEntries.projectId, projectId));
  }
  
  async getTimeEntriesByPersonnel(personnelId: number): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).where(eq(timeEntries.personnelId, personnelId));
  }
  
  async getTimeEntriesByClient(clientId: number): Promise<TimeEntry[]> {
    // 1. Obtener todas las cotizaciones del cliente
    const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, clientId));
    const clientQuotationIds = clientQuotations.map(q => q.id);
    
    // 2. Obtener todos los proyectos activos basados en esas cotizaciones
    const projects = await db.select().from(activeProjects).where(inArray(activeProjects.quotationId, clientQuotationIds));
    const projectIds = projects.map(p => p.id);
    
    // 3. Obtener todas las entradas de tiempo para esos proyectos
    if (projectIds.length === 0) return [];
    return await db.select().from(timeEntries).where(inArray(timeEntries.projectId, projectIds));
  }
  
  async getTimeEntryById(id: number): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry;
  }
  
  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const [newEntry] = await db.insert(timeEntries).values(entry).returning();
    return newEntry;
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
  
  // Progress report operations
  async getProgressReportsByProject(projectId: number): Promise<ProgressReport[]> {
    return await db.select().from(progressReports).where(eq(progressReports.projectId, projectId));
  }
  
  async getProgressReport(id: number): Promise<ProgressReport | undefined> {
    const [report] = await db.select().from(progressReports).where(eq(progressReports.id, id));
    return report;
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
  
  // Financial comparison operations
  async getProjectCostSummary(projectId: number): Promise<{
    estimatedCost: number;
    actualCost: number;
    variance: number;
    percentageUsed: number;
  }> {
    const [project] = await db.select().from(activeProjects).where(eq(activeProjects.id, projectId));
    if (!project) throw new Error(`Project with ID ${projectId} not found`);
    
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, project.quotationId));
    if (!quotation) throw new Error(`Quotation with ID ${project.quotationId} not found`);
    
    // Obtener todas las entradas de tiempo para el proyecto
    const entries = await db.select({
      timeEntry: timeEntries,
      personnel: personnel
    })
    .from(timeEntries)
    .innerJoin(personnel, eq(timeEntries.personnelId, personnel.id))
    .where(eq(timeEntries.projectId, projectId));
    
    // Calcular el costo real basado en las horas registradas
    let actualCost = 0;
    for (const entry of entries) {
      if (entry.timeEntry.billable) {
        actualCost += entry.personnel.hourlyRate * entry.timeEntry.hours;
      }
    }
    
    const estimatedCost = quotation.totalAmount;
    const variance = estimatedCost - actualCost;
    const percentageUsed = estimatedCost > 0 ? (actualCost / estimatedCost) * 100 : 0;
    
    return {
      estimatedCost,
      actualCost,
      variance,
      percentageUsed
    };
  }
  
  async getClientCostSummary(clientId: number): Promise<{
    totalEstimatedCost: number;
    totalActualCost: number;
    totalVariance: number;
    averagePercentageUsed: number;
    projectCount: number;
    projectsData: Array<{
      projectId: number;
      projectName: string;
      estimatedCost: number;
      actualCost: number;
      variance: number;
      percentageUsed: number;
    }>;
  }> {
    // 1. Obtener todas las cotizaciones del cliente
    const clientQuotations = await db.select().from(quotations).where(eq(quotations.clientId, clientId));
    if (clientQuotations.length === 0) {
      return {
        totalEstimatedCost: 0,
        totalActualCost: 0,
        totalVariance: 0,
        averagePercentageUsed: 0,
        projectCount: 0,
        projectsData: []
      };
    }
    
    // 2. Obtener todos los proyectos activos basados en esas cotizaciones
    const clientQuotationIds = clientQuotations.map(q => q.id);
    const projects = await db.select().from(activeProjects).where(inArray(activeProjects.quotationId, clientQuotationIds));
    
    if (projects.length === 0) {
      return {
        totalEstimatedCost: 0,
        totalActualCost: 0,
        totalVariance: 0,
        averagePercentageUsed: 0,
        projectCount: 0,
        projectsData: []
      };
    }
    
    // 3. Obtener resumen de costos para cada proyecto
    let totalEstimatedCost = 0;
    let totalActualCost = 0;
    let totalVariance = 0;
    let totalPercentageUsed = 0;
    const projectsData = [];
    
    for (const project of projects) {
      try {
        // Obtener el nombre del proyecto desde la cotización
        const quotation = clientQuotations.find(q => q.id === project.quotationId);
        const projectName = quotation ? quotation.projectName : 'Proyecto sin nombre';
        
        // Calcular costos
        const costSummary = await this.getProjectCostSummary(project.id);
        
        totalEstimatedCost += costSummary.estimatedCost;
        totalActualCost += costSummary.actualCost;
        totalVariance += costSummary.variance;
        totalPercentageUsed += costSummary.percentageUsed;
        
        projectsData.push({
          projectId: project.id,
          projectName,
          ...costSummary
        });
      } catch (error) {
        console.error(`Error getting cost summary for project ${project.id}:`, error);
      }
    }
    
    const averagePercentageUsed = projects.length > 0 ? totalPercentageUsed / projects.length : 0;
    
    return {
      totalEstimatedCost,
      totalActualCost,
      totalVariance,
      averagePercentageUsed,
      projectCount: projects.length,
      projectsData
    };
  }
  
  // Project Component Operations
  async getProjectComponents(projectId: number): Promise<ProjectComponent[]> {
    const result = await db.select().from(projectComponents).where(eq(projectComponents.projectId, projectId));
    return result;
  }

  async getProjectComponent(id: number): Promise<ProjectComponent | undefined> {
    const [component] = await db.select().from(projectComponents).where(eq(projectComponents.id, id));
    return component;
  }

  async createProjectComponent(component: InsertProjectComponent): Promise<ProjectComponent> {
    // Si isDefault es true, primero establecemos todos los demás componentes como no predeterminados
    if (component.isDefault) {
      await db.update(projectComponents)
        .set({ isDefault: false })
        .where(eq(projectComponents.projectId, component.projectId));
    }
    
    const [newComponent] = await db.insert(projectComponents).values(component).returning();
    return newComponent;
  }

  async updateProjectComponent(id: number, component: Partial<InsertProjectComponent>): Promise<ProjectComponent | undefined> {
    // Si isDefault es true, primero establecemos todos los demás componentes como no predeterminados
    if (component.isDefault) {
      // Obtener el componente para tener el projectId
      const [currentComponent] = await db.select().from(projectComponents).where(eq(projectComponents.id, id));
      if (currentComponent) {
        await db.update(projectComponents)
          .set({ isDefault: false })
          .where(and(
            eq(projectComponents.projectId, currentComponent.projectId),
            ne(projectComponents.id, id)
          ));
      }
    }
    
    const [updatedComponent] = await db.update(projectComponents)
      .set(component)
      .where(eq(projectComponents.id, id))
      .returning();
    
    return updatedComponent;
  }

  async deleteProjectComponent(id: number): Promise<boolean> {
    try {
      // 1. Verificar si el componente existe
      const [component] = await db.select().from(projectComponents).where(eq(projectComponents.id, id));
      if (!component) {
        return false;
      }
      
      // 2. Comprobar si hay entradas de tiempo asociadas a este componente
      const timeEntriesWithComponent = await db.select()
        .from(timeEntries)
        .where(eq(timeEntries.componentId, id));
      
      if (timeEntriesWithComponent.length > 0) {
        // Hay entradas de tiempo, actualizar a NULL el componente en lugar de eliminar
        await db.update(timeEntries)
          .set({ componentId: null })
          .where(eq(timeEntries.componentId, id));
      }
      
      // 3. Eliminar el componente
      const [deletedComponent] = await db.delete(projectComponents)
        .where(eq(projectComponents.id, id))
        .returning();
      
      return !!deletedComponent;
    } catch (error) {
      console.error(`Error al eliminar componente de proyecto ${id}:`, error);
      return false;
    }
  }

  async getDefaultProjectComponent(projectId: number): Promise<ProjectComponent | undefined> {
    const [component] = await db.select()
      .from(projectComponents)
      .where(and(
        eq(projectComponents.projectId, projectId),
        eq(projectComponents.isDefault, true)
      ));
    
    return component;
  }
  
  // MODO operations
  async getDeliverables(clientId?: number): Promise<Deliverable[]> {
    try {
      let query = db.select().from(deliverables);
      
      // Con la tabla que creamos manualmente, no tenemos el campo clientId
      // Entonces por ahora ignoraremos ese filtro y devolveremos todos los entregables
      // Cuando se haga la migración completa, se puede descomentar estas líneas
      /*
      if (clientId) {
        query = query.where(eq(deliverables.clientId, clientId));
      }
      
      return await query.orderBy(deliverables.deliveryMonth);
      */
      
      // Por ahora simplemente devolvemos todos los datos
      return await query;
    } catch (error) {
      console.error("Error in getDeliverables:", error);
      return [];
    }
  }
  
  async getDeliverable(id: number): Promise<any | undefined> {
    try {
      const result = await db.execute(
        `SELECT * FROM deliverables WHERE id = ${id}`
      );
      
      if (result.rows && result.rows.length > 0) {
        return result.rows[0];
      }
      return undefined;
    } catch (error) {
      console.error("Error fetching deliverable:", error);
      return undefined;
    }
  }
  
  async createDeliverable(deliverable: InsertDeliverable): Promise<Deliverable> {
    const [newDeliverable] = await db.insert(deliverables).values(deliverable).returning();
    return newDeliverable;
  }
  
  async updateDeliverable(id: number, deliverable: any): Promise<any | undefined> {
    try {
      const existingDeliverable = await this.getDeliverable(id);
      if (!existingDeliverable) {
        return undefined;
      }
      
      // Añadir fecha de actualización
      if (!deliverable.updated_at) {
        deliverable.updated_at = new Date();
      }
      
      // Construir la consulta SET dinámicamente
      let setClause = '';
      const entries = Object.entries(deliverable);
      
      entries.forEach(([key, value], index) => {
        // Agregar la coma si no es el primer elemento
        if (index > 0) setClause += ', ';
        
        // Manejar el valor según su tipo
        if (value === null) {
          setClause += `${key} = NULL`;
        } else if (typeof value === 'string') {
          setClause += `${key} = '${value.replace(/'/g, "''")}'`; // Escapar comillas simples
        } else if (value instanceof Date) {
          setClause += `${key} = '${value.toISOString()}'`;
        } else {
          setClause += `${key} = ${value}`;
        }
      });
      
      if (!setClause) {
        return existingDeliverable; // No hay cambios que hacer
      }
      
      const query = `
        UPDATE deliverables 
        SET ${setClause} 
        WHERE id = ${id} 
        RETURNING *
      `;
      
      const result = await db.execute(query);
      
      if (result.rows && result.rows.length > 0) {
        return result.rows[0];
      }
      return undefined;
    } catch (error) {
      console.error("Error updating deliverable:", error);
      return undefined;
    }
  }
  
  async deleteDeliverable(id: number): Promise<boolean> {
    try {
      const result = await db.delete(deliverables).where(eq(deliverables.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting deliverable:", error);
      return false;
    }
  }
  
  async getClientModoComments(clientId: number): Promise<ClientModoComment[]> {
    console.log(`Buscando comentarios MODO para cliente ID: ${clientId}`);
    const comments = await db
      .select()
      .from(clientModoComments)
      .where(eq(clientModoComments.client_id, clientId))
      .orderBy(clientModoComments.year, "desc")
      .orderBy(clientModoComments.quarter, "desc");
    
    console.log(`Encontrados ${comments.length} comentarios MODO`);
    return comments;
  }
  
  async getClientModoComment(id: number): Promise<ClientModoComment | undefined> {
    const [comment] = await db.select().from(clientModoComments).where(eq(clientModoComments.id, id));
    return comment;
  }
  
  async getClientModoCommentByQuarter(clientId: number, quarter: number, year: number): Promise<ClientModoComment | undefined> {
    console.log(`Buscando comentario MODO para cliente ID: ${clientId}, Q${quarter} ${year}`);
    const [comment] = await db
      .select()
      .from(clientModoComments)
      .where(
        and(
          eq(clientModoComments.client_id, clientId),
          eq(clientModoComments.quarter, quarter),
          eq(clientModoComments.year, year)
        )
      );
    return comment;
  }
  

  
  async updateClientModoComment(id: number, comment: Partial<InsertClientModoComment>): Promise<ClientModoComment | undefined> {
    try {
      const existingComment = await this.getClientModoComment(id);
      if (!existingComment) {
        return undefined;
      }
      
      const [updatedComment] = await db
        .update(clientModoComments)
        .set({
          ...comment,
          updatedAt: new Date()
        })
        .where(eq(clientModoComments.id, id))
        .returning();
      
      return updatedComment;
    } catch (error) {
      console.error("Error updating MODO comment:", error);
      throw error;
    }
  }
  
  async deleteClientModoComment(id: number): Promise<boolean> {
    try {
      const result = await db.delete(clientModoComments).where(eq(clientModoComments.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting MODO comment:", error);
      return false;
    }
  }
  
  async getClientModoSummary(clientId: number): Promise<{
    totalDeliverables: number;
    onTimeDeliveries: number;
    onTimePercentage: number;
    averageScores: {
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
      console.log(`Obteniendo datos MODO para cliente ID: ${clientId}`);
      
      // Obtener todos los entregables - por ahora usamos todos los entregables
      // independientemente del cliente porque nuestra tabla no tiene relación con clientes directamente
      const clientDeliverables = await db
        .select()
        .from(deliverables);
        
      console.log(`Encontrados ${clientDeliverables.length} entregables en total`);
      // En una implementación futura, filtraríamos por project_id donde el proyecto pertenezca al cliente
      // Por ahora usamos todos los entregables para prueba
      
    
      // Calcular métricas
      const totalDeliverables = clientDeliverables.length;
      const onTimeDeliveries = clientDeliverables.filter(d => d.on_time).length;
      const onTimePercentage = totalDeliverables > 0 ? (onTimeDeliveries / totalDeliverables) * 100 : 0;
      
      // Inicializar sumas para promedios
      let sumNarrativeQuality = 0;
      let sumGraphicsEffectiveness = 0;
      let sumFormatDesign = 0;
      let sumRelevantInsights = 0;
      let sumOperationsFeedback = 0;
      let sumClientFeedback = 0;
      let sumBriefCompliance = 0;
      
      let countNarrativeQuality = 0;
      let countGraphicsEffectiveness = 0;
      let countFormatDesign = 0;
      let countRelevantInsights = 0;
      let countOperationsFeedback = 0;
      let countClientFeedback = 0;
      let countBriefCompliance = 0;
      
      // Sumar valores para cada categoría (ignorando null/undefined)
      for (const deliverable of clientDeliverables) {
        if (deliverable.narrative_quality !== null && deliverable.narrative_quality !== undefined) {
          sumNarrativeQuality += Number(deliverable.narrative_quality);
          countNarrativeQuality++;
        }
        
        if (deliverable.graphics_effectiveness !== null && deliverable.graphics_effectiveness !== undefined) {
          sumGraphicsEffectiveness += Number(deliverable.graphics_effectiveness);
          countGraphicsEffectiveness++;
        }
        
        if (deliverable.format_design !== null && deliverable.format_design !== undefined) {
          sumFormatDesign += Number(deliverable.format_design);
          countFormatDesign++;
        }
        
        if (deliverable.relevant_insights !== null && deliverable.relevant_insights !== undefined) {
          sumRelevantInsights += Number(deliverable.relevant_insights);
          countRelevantInsights++;
        }
        
        if (deliverable.operations_feedback !== null && deliverable.operations_feedback !== undefined) {
          sumOperationsFeedback += Number(deliverable.operations_feedback);
          countOperationsFeedback++;
        }
        
        if (deliverable.client_feedback !== null && deliverable.client_feedback !== undefined) {
          sumClientFeedback += Number(deliverable.client_feedback);
          countClientFeedback++;
        }
        
        if (deliverable.brief_compliance !== null && deliverable.brief_compliance !== undefined) {
          sumBriefCompliance += Number(deliverable.brief_compliance);
          countBriefCompliance++;
        }
      }
      
      // Calcular promedios
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
        .where(eq(clientModoComments.client_id, clientId))
        .orderBy(desc(clientModoComments.year));
      
      console.log(`Encontrados ${comments.length} comentarios para el cliente ID: ${clientId}`);
      
      const totalComments = comments.length;
      const latestComment = comments.length > 0 ? comments[0] : undefined;
      
      return {
        totalDeliverables,
        onTimeDeliveries,
        onTimePercentage,
        averageScores: {
          narrativeQuality: averageNarrativeQuality,
          graphicsEffectiveness: averageGraphicsEffectiveness,
          formatDesign: averageFormatDesign,
          relevantInsights: averageRelevantInsights,
          operationsFeedback: averageOperationsFeedback,
          clientFeedback: averageClientFeedback,
          briefCompliance: averageBriefCompliance
        },
        totalComments,
        latestComment
      };
    } catch (error) {
      console.error("Error al obtener resumen MODO del cliente:", error);
      throw error;
    }
  }
  
  async getClientModoComments(clientId: number): Promise<ClientModoComment[]> {
    try {
      console.log(`Obteniendo comentarios MODO para cliente ID: ${clientId}`);
      const comments = await db
        .select()
        .from(clientModoComments)
        .where(eq(clientModoComments.client_id, clientId))
        .orderBy(desc(clientModoComments.year), desc(clientModoComments.quarter));
      
      console.log(`Encontrados ${comments.length} comentarios MODO`);
      return comments;
    } catch (error) {
      console.error("Error al obtener comentarios MODO:", error);
      throw error;
    }
  }
  
  async createClientModoComment(comment: any): Promise<ClientModoComment> {
    try {
      console.log("Datos recibidos para crear comentario MODO:", comment);
      
      // Adaptamos los datos al esquema real de la tabla
      const dataToInsert = {
        client_id: comment.clientId || comment.client_id,
        comment_text: comment.comments || comment.comment_text,
        year: comment.year,
        quarter: comment.quarter,
        timestamp: new Date().toISOString()
      };
      
      console.log("Datos a insertar:", dataToInsert);
      const [newComment] = await db.insert(clientModoComments).values(dataToInsert).returning();
      
      return newComment;
    } catch (error) {
      console.error("Error al crear comentario MODO:", error);
      throw error;
    }
  }
  
  async getDeliverablesByProjects(projectIds: number[]): Promise<Deliverable[]> {
    try {
      if (projectIds.length === 0) return [];
      
      console.log(`Obteniendo entregables para los proyectos: ${projectIds.join(", ")}`);
      
      // Ejecutamos una consulta SQL directa para obtener los entregables
      const { rows } = await db.execute(
        `SELECT * FROM deliverables 
         WHERE project_id IN (${projectIds.join(',')}) 
         ORDER BY delivery_date DESC`
      );
      
      console.log(`Encontrados ${rows.length} entregables`);
      return rows;
    } catch (error) {
      console.error("Error al obtener entregables:", error);
      throw error;
    }
  }
  
  async createDeliverable(deliverable: any): Promise<Deliverable> {
    try {
      console.log("Datos recibidos para crear entregable:", deliverable);
      
      // Adaptamos los datos al esquema real de la tabla
      const dataToInsert = {
        project_id: deliverable.projectId || deliverable.project_id,
        title: deliverable.name || deliverable.title,
        delivery_date: deliverable.deliveryDate || new Date().toISOString(),
        due_date: deliverable.dueDate || deliverable.due_date || new Date().toISOString(),
        on_time: deliverable.onTime || deliverable.deliveryOnTime || deliverable.on_time || false,
        narrative_quality: deliverable.narrativeQuality || deliverable.narrative_quality,
        graphics_effectiveness: deliverable.graphicsEffectiveness || deliverable.graphics_effectiveness,
        format_design: deliverable.formatDesign || deliverable.format_design,
        relevant_insights: deliverable.relevantInsights || deliverable.relevant_insights,
        operations_feedback: deliverable.operationsFeedback || deliverable.operations_feedback,
        client_feedback: deliverable.clientFeedback || deliverable.client_feedback,
        brief_compliance: deliverable.briefCompliance || deliverable.brief_compliance,
        notes: deliverable.notes || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log("Datos a insertar:", dataToInsert);
      
      // Usamos SQL directo para evitar problemas de mapeo con Drizzle
      const { rows } = await db.execute(
        `INSERT INTO deliverables (
          project_id, title, delivery_date, due_date, on_time, 
          narrative_quality, graphics_effectiveness, format_design, 
          relevant_insights, operations_feedback, client_feedback, 
          brief_compliance, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING *`,
        [
          dataToInsert.project_id,
          dataToInsert.title,
          dataToInsert.delivery_date,
          dataToInsert.due_date,
          dataToInsert.on_time,
          dataToInsert.narrative_quality,
          dataToInsert.graphics_effectiveness,
          dataToInsert.format_design,
          dataToInsert.relevant_insights,
          dataToInsert.operations_feedback,
          dataToInsert.client_feedback,
          dataToInsert.brief_compliance,
          dataToInsert.notes,
          dataToInsert.created_at,
          dataToInsert.updated_at
        ]
      );
      
      return rows[0];
    } catch (error) {
      console.error("Error al crear entregable:", error);
      throw error;
    }
  }
  
  async updateDeliverable(id: number, data: any): Promise<Deliverable | undefined> {
    try {
      console.log(`Actualizando entregable ID ${id} con datos:`, data);
      
      // Preparamos los datos para actualizar según la estructura real de la tabla
      const updateData: any = { updated_at: new Date().toISOString() };
      
      // Mapeamos los campos según corresponda en la estructura real
      if (data.name !== undefined) updateData.title = data.name;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.projectId !== undefined) updateData.project_id = data.projectId;
      if (data.project_id !== undefined) updateData.project_id = data.project_id;
      if (data.deliveryDate !== undefined) updateData.delivery_date = data.deliveryDate;
      if (data.delivery_date !== undefined) updateData.delivery_date = data.delivery_date;
      if (data.dueDate !== undefined) updateData.due_date = data.dueDate;
      if (data.due_date !== undefined) updateData.due_date = data.due_date;
      if (data.onTime !== undefined) updateData.on_time = data.onTime;
      if (data.deliveryOnTime !== undefined) updateData.on_time = data.deliveryOnTime;
      if (data.on_time !== undefined) updateData.on_time = data.on_time;
      if (data.narrativeQuality !== undefined) updateData.narrative_quality = data.narrativeQuality;
      if (data.narrative_quality !== undefined) updateData.narrative_quality = data.narrative_quality;
      if (data.graphicsEffectiveness !== undefined) updateData.graphics_effectiveness = data.graphicsEffectiveness;
      if (data.graphics_effectiveness !== undefined) updateData.graphics_effectiveness = data.graphics_effectiveness;
      if (data.formatDesign !== undefined) updateData.format_design = data.formatDesign;
      if (data.format_design !== undefined) updateData.format_design = data.format_design;
      if (data.relevantInsights !== undefined) updateData.relevant_insights = data.relevantInsights;
      if (data.relevant_insights !== undefined) updateData.relevant_insights = data.relevant_insights;
      if (data.operationsFeedback !== undefined) updateData.operations_feedback = data.operationsFeedback;
      if (data.operations_feedback !== undefined) updateData.operations_feedback = data.operations_feedback;
      if (data.clientFeedback !== undefined) updateData.client_feedback = data.clientFeedback;
      if (data.client_feedback !== undefined) updateData.client_feedback = data.client_feedback;
      if (data.briefCompliance !== undefined) updateData.brief_compliance = data.briefCompliance;
      if (data.brief_compliance !== undefined) updateData.brief_compliance = data.brief_compliance;
      if (data.notes !== undefined) updateData.notes = data.notes;
      
      console.log("Datos de actualización preparados:", updateData);
      
      // Construimos un SET dinámico para la consulta SQL
      const setClauses = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(updateData)];
      
      // Ejecutamos la consulta SQL directa
      const { rows } = await db.execute(
        `UPDATE deliverables SET ${setClauses} WHERE id = $1 RETURNING *`,
        values
      );
      
      if (rows.length === 0) {
        console.log(`No se encontró el entregable con ID ${id}`);
        return undefined;
      }
      
      console.log(`Entregable ID ${id} actualizado correctamente`);
      return rows[0];
    } catch (error) {
      console.error(`Error al actualizar entregable ID ${id}:`, error);
      throw error;
    }
  }
}

// Exportar la implementación de la base de datos en lugar de la memoria
export const storage = new DatabaseStorage();
