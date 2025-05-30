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
  type QuarterlyNpsSurvey, type InsertQuarterlyNpsSurvey,
  clients, roles, personnel, reportTemplates, quotations, quotationTeamMembers, templateRoleAssignments,
  activeProjects, projectComponents, timeEntries, progressReports, users, quarterlyNpsSurveys,
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

  // Quotation operations
  getQuotations(): Promise<Quotation[]>;
  getQuotationsByClient(clientId: number): Promise<Quotation[]>;
  getQuotation(id: number): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  deleteQuotation(id: number): Promise<boolean>;

  // Quotation team member operations
  getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]>;
  createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember>;
  updateQuotationTeamMember(id: number, member: Partial<InsertQuotationTeamMember>): Promise<QuotationTeamMember | undefined>;
  deleteQuotationTeamMember(id: number): Promise<boolean>;

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
  getMentionsVolumeOptions(): Promise<typeof mentionsVolumeOptions>;
  getCountriesCoveredOptions(): Promise<typeof countriesCoveredOptions>;
  getClientEngagementOptions(): Promise<typeof clientEngagementOptions>;
  getProjectStatusOptions(): Promise<typeof projectStatusOptions>;
  getTrackingFrequencyOptions(): Promise<typeof trackingFrequencyOptions>;

  // Active project operations
  getActiveProjects(): Promise<(ActiveProject & { quotation: Quotation & { client?: Client } })[]>;
  getActiveProjectsByClient(clientId: number): Promise<(ActiveProject & { quotation: Quotation })[]>;
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
}

// IMPLEMENTACIÓN UNIFICADA DE BASE DE DATOS
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
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
      ttl: 60 * 60 * 24 * 180,
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
      console.log(`Eliminando proyecto ID ${id} de forma segura...`);
      
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
        
        // 5. Actualizar proyectos hijos para quitar la referencia padre
        await tx.update(activeProjects)
          .set({ parentProjectId: null })
          .where(eq(activeProjects.parentProjectId, id));
        
        // 6. Finalmente eliminar el proyecto
        await tx.delete(activeProjects).where(eq(activeProjects.id, id));
      });
      
      console.log(`Proyecto ${id} eliminado correctamente`);
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
    const [updatedPerson] = await db
      .update(personnel)
      .set(person)
      .where(eq(personnel.id, id))
      .returning();
    return updatedPerson;
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
    await db.delete(quotations).where(eq(quotations.id, id));
    const quotation = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation.length === 0;
  }

  // Quotation team member operations
  async getQuotationTeamMembers(quotationId: number): Promise<QuotationTeamMember[]> {
    return await db.select().from(quotationTeamMembers).where(eq(quotationTeamMembers.quotationId, quotationId));
  }

  async createQuotationTeamMember(member: InsertQuotationTeamMember): Promise<QuotationTeamMember> {
    const [newMember] = await db.insert(quotationTeamMembers).values(member).returning();
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
      
      console.log(`Obteniendo entregables para los proyectos: ${projectIds.join(", ")}`);
      
      const deliverableList = await db.select().from(deliverables).where(inArray(deliverables.project_id, projectIds));
      
      console.log(`Encontrados ${deliverableList.length} entregables`);
      return deliverableList;
    } catch (error) {
      console.error("Error al obtener entregables:", error);
      throw error;
    }
  }
  
  async createDeliverable(deliverable: any): Promise<Deliverable> {
    try {
      console.log("Datos recibidos para crear entregable:", deliverable);
      
      const dataToInsert = {
        project_id: deliverable.projectId || deliverable.project_id,
        name: deliverable.name || deliverable.title,
        client_id: deliverable.clientId || deliverable.client_id,
        delivery_month: deliverable.deliveryMonth || new Date().toISOString().substring(0, 7),
        due_date: deliverable.dueDate || deliverable.due_date || new Date(),
        delivery_on_time: deliverable.onTime || deliverable.deliveryOnTime || deliverable.on_time || false,
        narrative_quality: deliverable.narrativeQuality || deliverable.narrative_quality || 0,
        graphics_effectiveness: deliverable.graphicsEffectiveness || deliverable.graphics_effectiveness || 0,
        format_design: deliverable.formatDesign || deliverable.format_design || 0,
        relevant_insights: deliverable.relevantInsights || deliverable.relevant_insights || 0,
        operations_feedback: deliverable.operationsFeedback || deliverable.operations_feedback || 0,
        client_feedback: deliverable.clientFeedback || deliverable.client_feedback || 0,
        brief_compliance: deliverable.briefCompliance || deliverable.brief_compliance || 0,
        notes: deliverable.notes || "",
        created_at: new Date(),
        updated_at: new Date()
      };
      
      console.log("Datos a insertar:", dataToInsert);
      
      const [newDeliverable] = await db.insert(deliverables).values([dataToInsert]).returning();
      return newDeliverable;
    } catch (error) {
      console.error("Error al crear entregable:", error);
      throw error;
    }
  }
  
  async updateDeliverable(id: number, data: any): Promise<Deliverable | undefined> {
    try {
      console.log(`Actualizando entregable ID ${id} con datos:`, data);
      
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
      
      console.log("Datos de actualización preparados:", updateData);
      
      const [updatedDeliverable] = await db
        .update(deliverables)
        .set(updateData)
        .where(eq(deliverables.id, id))
        .returning();
      
      if (!updatedDeliverable) {
        console.log(`No se encontró el entregable con ID ${id}`);
        return undefined;
      }
      
      console.log(`Entregable ID ${id} actualizado correctamente`);
      return updatedDeliverable;
    } catch (error) {
      console.error(`Error al actualizar entregable ID ${id}:`, error);
      throw error;
    }
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
      console.log(`Obteniendo estadísticas para el cliente ID: ${clientId}`);
      
      // Obtener proyectos del cliente
      const clientProjects = await this.getActiveProjectsByClient(clientId);
      const projectIds = clientProjects.map(p => p.id);
      
      console.log(`Proyectos del cliente: [${projectIds.join(", ")}]`);
      
      // Obtener entregables
      const deliverablesList = await this.getDeliverablesByProjects(projectIds);
      
      console.log(`Entregables encontrados: ${deliverablesList.length}`);
      
      // Calcular estadísticas
      const totalDeliverables = deliverablesList.length;
      const onTimeDeliveries = deliverablesList.filter(d => d.onTime).length;
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
        if (d.narrativeQuality != null) { sumNarrativeQuality += d.narrativeQuality; countNarrativeQuality++; }
        if (d.graphicsEffectiveness != null) { sumGraphicsEffectiveness += d.graphicsEffectiveness; countGraphicsEffectiveness++; }
        if (d.formatDesign != null) { sumFormatDesign += d.formatDesign; countFormatDesign++; }
        if (d.relevantInsights != null) { sumRelevantInsights += d.relevantInsights; countRelevantInsights++; }
        if (d.operationsFeedback != null) { sumOperationsFeedback += d.operationsFeedback; countOperationsFeedback++; }
        if (d.clientFeedback != null) { sumClientFeedback += d.clientFeedback; countClientFeedback++; }
        if (d.briefCompliance != null) { sumBriefCompliance += d.briefCompliance; countBriefCompliance++; }
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
      
      console.log(`Encontrados ${comments.length} comentarios para el cliente ID: ${clientId}`);
      
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
      console.log("Datos recibidos para crear comentario MODO:", comment);
      
      const dataToInsert = {
        client_id: comment.clientId || comment.client_id,
        comments: comment.comments || comment.comment_text,
        year: comment.year,
        quarter: comment.quarter,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      console.log("Datos a insertar:", dataToInsert);
      const [newComment] = await db.insert(clientModoComments).values([dataToInsert]).returning();
      
      return newComment;
    } catch (error) {
      console.error("Error al crear comentario MODO:", error);
      throw error;
    }
  }

  // NPS Survey operations
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
      console.log(`Encuesta NPS creada para cliente ${survey.clientId}`);
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

  // Métodos faltantes para corregir errores de TypeScript
  async getActiveProjectsByQuotationId(quotationId: number): Promise<ActiveProject[]> {
    try {
      return await db.select().from(activeProjects).where(eq(activeProjects.quotationId, quotationId));
    } catch (error) {
      console.error("Error al obtener proyectos activos por cotización:", error);
      throw error;
    }
  }

  async deleteQuotationTeamMembers(quotationId: number): Promise<void> {
    try {
      await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.quotationId, quotationId));
    } catch (error) {
      console.error("Error al eliminar miembros del equipo:", error);
      throw error;
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
      const projects = await db.select().from(activeProjects).where(eq(activeProjects.client_id, clientId));
      const allTimeEntries = await db.select().from(timeEntries);
      
      let totalCost = 0;
      let totalBudget = 0;
      
      for (const project of projects) {
        totalBudget += parseFloat(project.costLimit || '0');
        const projectTimeEntries = allTimeEntries.filter((te: any) => te.projectId === project.id);
        for (const entry of projectTimeEntries) {
          totalCost += parseFloat(entry.totalCost || '0');
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

  async getActiveProjectsByParentId(parentId: number): Promise<ActiveProject[]> {
    try {
      return await db.select().from(activeProjects).where(eq(activeProjects.parentProjectId, parentId));
    } catch (error) {
      console.error("Error al obtener proyectos activos por padre:", error);
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

  async getProjectCostSummary(projectId: number): Promise<any> {
    try {
      const project = await this.getActiveProject(projectId);
      if (!project) return null;

      const entries = await db.select().from(timeEntries).where(eq(timeEntries.projectId, projectId));
      
      let totalCost = 0;
      for (const entry of entries) {
        totalCost += parseFloat(entry.totalCost || '0');
      }
      
      const budget = parseFloat(project.costLimit || '0');
      
      return {
        projectId,
        totalCost,
        budget,
        variance: budget - totalCost,
        percentageUsed: budget ? (totalCost / budget) * 100 : 0
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
          eq(clientModoComments.client_id, clientId),
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
          updated_at: new Date()
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
        .where(eq(clientModoComments.client_id, clientId));
      
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

  async deleteQuotationTeamMemberById(id: number): Promise<boolean> {
    try {
      await db.delete(quotationTeamMembers).where(eq(quotationTeamMembers.id, id));
      return true;
    } catch (error) {
      console.error("Error al eliminar miembro del equipo por ID:", error);
      return false;
    }
  }
}

// Exportar solo la implementación de base de datos
export const storage = new DatabaseStorage();