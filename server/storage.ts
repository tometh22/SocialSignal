import {
  type Client, type InsertClient,
  type Role, type InsertRole,
  type Personnel, type InsertPersonnel,
  type ReportTemplate, type InsertReportTemplate,
  type Quotation, type InsertQuotation,
  type QuotationTeamMember, type InsertQuotationTeamMember,
  clients, roles, personnel, reportTemplates, quotations, quotationTeamMembers,
  analysisTypes, projectTypes, mentionsVolumeOptions, countriesCoveredOptions, clientEngagementOptions
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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

  // Quotation operations
  getQuotations(): Promise<Quotation[]>;
  getQuotationsByClient(clientId: number): Promise<Quotation[]>;
  getQuotation(id: number): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  updateQuotationStatus(id: number, status: string): Promise<Quotation | undefined>;

  // Quotation team members operations
  getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]>;
  createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember>;
  deleteQuotationTeamMembers(quotationId: number): Promise<void>;

  // Get option lists
  getAnalysisTypes(): Promise<typeof analysisTypes>;
  getProjectTypes(): Promise<typeof projectTypes>;
  getMentionsVolumeOptions(): Promise<typeof mentionsVolumeOptions>;
  getCountriesCoveredOptions(): Promise<typeof countriesCoveredOptions>;
  getClientEngagementOptions(): Promise<typeof clientEngagementOptions>;
}

export class MemStorage implements IStorage {
  private clients: Map<number, Client>;
  private roles: Map<number, Role>;
  private personnel: Map<number, Personnel>;
  private reportTemplates: Map<number, ReportTemplate>;
  private quotations: Map<number, Quotation>;
  private quotationTeamMembers: Map<number, QuotationTeamMember>;
  
  private clientId: number;
  private roleId: number;
  private personnelId: number;
  private templateId: number;
  private quotationId: number;
  private quotationTeamMemberId: number;

  constructor() {
    this.clients = new Map();
    this.roles = new Map();
    this.personnel = new Map();
    this.reportTemplates = new Map();
    this.quotations = new Map();
    this.quotationTeamMembers = new Map();
    
    this.clientId = 1;
    this.roleId = 1;
    this.personnelId = 1;
    this.templateId = 1;
    this.quotationId = 1;
    this.quotationTeamMemberId = 1;
    
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
    this.createReportTemplate({
      name: "Panel Ejecutivo",
      description: "Métricas concisas de alto nivel con ideas clave y recomendaciones estratégicas. Ideal para directivos.",
      complexity: "low",
      pageRange: "5-10 páginas",
      features: "Métricas principales"
    });
    
    this.createReportTemplate({
      name: "Análisis Completo",
      description: "Evaluación detallada con métricas extensas, segmentación de audiencia y desglose demográfico.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Métricas avanzadas"
    });
    
    this.createReportTemplate({
      name: "Rendimiento de Campaña",
      description: "Análisis previo, durante y posterior a la campaña con seguimiento de KPI y datos comparativos de referencia.",
      complexity: "high",
      pageRange: "20-30 páginas",
      features: "Análisis de tendencias"
    });
    
    this.createReportTemplate({
      name: "Plantilla Personalizada",
      description: "Estructura de informe personalizada basada en requisitos específicos del cliente y objetivos del proyecto.",
      complexity: "variable",
      pageRange: "Longitud variable",
      features: "Métricas personalizadas"
    });
    
    this.createReportTemplate({
      name: "Informe de Crisis",
      description: "Monitoreo intensivo y análisis de situaciones críticas que requieren respuesta inmediata.",
      complexity: "high",
      pageRange: "10-20 páginas",
      features: "Alertas y recomendaciones"
    });
    
    this.createReportTemplate({
      name: "Informe de Precios",
      description: "Análisis comparativo de precios del mercado con identificación de oportunidades y riesgos.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Análisis competitivo"
    });
    
    this.createReportTemplate({
      name: "Análisis de Conversación Digital",
      description: "Estudio profundo de conversaciones en redes sociales con análisis de sentimiento y temas emergentes.",
      complexity: "high",
      pageRange: "20-30 páginas",
      features: "Análisis semántico"
    });
    
    this.createReportTemplate({
      name: "Informe Mensual",
      description: "Resumen periódico de KPIs principales, tendencias del mes y recomendaciones tácticas.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Comparativa mensual"
    });
    
    this.createReportTemplate({
      name: "Informe Semanal",
      description: "Actualización rápida con datos clave de la semana y alertas de cambios significativos.",
      complexity: "low",
      pageRange: "5-10 páginas",
      features: "Métricas ágiles"
    });
    
    this.createReportTemplate({
      name: "Informe SOV (Share of Voice)",
      description: "Análisis de la cuota de conversación de la marca respecto a competidores en canales digitales.",
      complexity: "medium",
      pageRange: "10-20 páginas",
      features: "Visualización comparativa"
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
    const [updatedClient] = await db
      .update(clients)
      .set(client)
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
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

// Exportar la implementación de la base de datos en lugar de la memoria
export const storage = new DatabaseStorage();
