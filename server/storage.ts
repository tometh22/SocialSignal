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
      name: "Executive Dashboard",
      description: "Concise, high-level metrics with key insights and strategic recommendations. Ideal for executive stakeholders.",
      complexity: "low",
      pageRange: "5-10 pages",
      features: "Core metrics only"
    });
    
    this.createReportTemplate({
      name: "Comprehensive Analysis",
      description: "Detailed evaluation with extensive metrics, audience segmentation, and demographic breakdown.",
      complexity: "medium",
      pageRange: "15-25 pages",
      features: "Advanced metrics"
    });
    
    this.createReportTemplate({
      name: "Campaign Performance",
      description: "Pre, during, and post campaign analysis with KPI tracking and comparative benchmark data.",
      complexity: "high",
      pageRange: "20-30 pages",
      features: "Trend analysis"
    });
    
    this.createReportTemplate({
      name: "Custom Template",
      description: "Build a custom report structure based on specific client requirements and project goals.",
      complexity: "variable",
      pageRange: "Variable length",
      features: "Custom metrics"
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

export const storage = new MemStorage();
