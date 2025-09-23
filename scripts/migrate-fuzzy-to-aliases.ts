/**
 * Migration Script: Convert Fuzzy Matches to Explicit Project Aliases
 * 
 * This script captures all successful fuzzy matches from the current system
 * and converts them into explicit project_aliases entries for bulletproof mapping.
 */

import { db } from '../server/db';
import { projectAliases } from '@shared/schema';
import { projectKey } from '../server/utils/normalize';

interface ProjectMapping {
  projectId: number;
  projectName: string;
  clientName: string;
  excelClient: string;
  excelProject: string;
  matchType: 'exact' | 'fuzzy';
  confidence: number;
}

export class FuzzyToAliasesMigrator {
  
  /**
   * Main migration method - captures current fuzzy matches and creates aliases
   */
  async migrate() {
    console.log('🔄 Starting fuzzy-to-aliases migration...');
    
    try {
      // 1. Get current catalog projects
      const catalogProjects = await this.getCatalogProjects();
      console.log(`📊 Found ${catalogProjects.length} catalog projects`);
      
      // 2. Get all Excel data (sales + costs) for discovery
      const excelMappings = await this.discoverExcelMappings(catalogProjects);
      console.log(`📊 Discovered ${excelMappings.length} Excel mappings`);
      
      // 3. Convert to aliases and insert
      const aliases = await this.createAliasesFromMappings(excelMappings);
      console.log(`📊 Created ${aliases.length} aliases`);
      
      // 4. Summary and verification
      await this.printMigrationSummary();
      
      console.log('✅ Migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
  
  /**
   * Get all active projects from catalog
   */
  private async getCatalogProjects() {
    // Using the same method as the active projects aggregator
    const { storage } = await import('../server/storage');
    return await storage.getActiveProjects();
  }
  
  /**
   * Discover all Excel project names by analyzing sales and costs data
   */
  private async discoverExcelMappings(catalogProjects: any[]): Promise<ProjectMapping[]> {
    const mappings: ProjectMapping[] = [];
    const uniquePairs = new Set<string>();
    
    // Get sales data
    const { storage } = await import('../server/storage');
    const salesData = await storage.getGoogleSheetsSales();
    const costsData = await storage.getDirectCosts();
    
    console.log(`📊 Analyzing ${salesData.length} sales records and ${costsData.length} cost records...`);
    
    // Process sales data
    for (const sale of salesData) {
      const excelClient = sale.clientName || '';
      const excelProject = sale.projectName || '';
      const pairKey = `${excelClient}||${excelProject}`;
      
      if (!excelClient || !excelProject || uniquePairs.has(pairKey)) continue;
      uniquePairs.add(pairKey);
      
      const mapping = this.resolveProjectMapping(excelClient, excelProject, catalogProjects);
      if (mapping) {
        mappings.push(mapping);
        console.log(`✅ Sales mapping: "${excelClient}" + "${excelProject}" → Project ${mapping.projectId}`);
      } else {
        console.log(`⚠️ Sales orphan: "${excelClient}" + "${excelProject}" - no project match`);
      }
    }
    
    // Process costs data
    for (const cost of costsData) {
      const excelClient = cost.cliente || '';
      const excelProject = cost.proyecto || '';
      const pairKey = `${excelClient}||${excelProject}`;
      
      if (!excelClient || !excelProject || uniquePairs.has(pairKey)) continue;
      uniquePairs.add(pairKey);
      
      const mapping = this.resolveProjectMapping(excelClient, excelProject, catalogProjects);
      if (mapping) {
        mappings.push(mapping);
        console.log(`✅ Cost mapping: "${excelClient}" + "${excelProject}" → Project ${mapping.projectId}`);
      } else {
        console.log(`⚠️ Cost orphan: "${excelClient}" + "${excelProject}" - no project match`);
      }
    }
    
    return mappings;
  }
  
  /**
   * Resolve Excel names to catalog projects using the same fuzzy logic
   */
  private resolveProjectMapping(excelClient: string, excelProject: string, catalogProjects: any[]): ProjectMapping | null {
    if (!excelProject) return null;
    
    const targetKey = projectKey(excelProject);
    
    // Try exact match first
    for (const project of catalogProjects) {
      const actualProjectName = project.quotation?.projectName || `Project-${project.id}`;
      const catalogKey = projectKey(actualProjectName);
      
      if (catalogKey === targetKey) {
        return {
          projectId: project.id,
          projectName: actualProjectName,
          clientName: project.client?.name || '',
          excelClient,
          excelProject,
          matchType: 'exact',
          confidence: 1.0
        };
      }
    }
    
    // Try fuzzy match
    for (const project of catalogProjects) {
      const actualProjectName = project.quotation?.projectName || `Project-${project.id}`;
      const catalogKey = projectKey(actualProjectName);
      
      if (catalogKey.includes(targetKey) || targetKey.includes(catalogKey)) {
        return {
          projectId: project.id,
          projectName: actualProjectName,
          clientName: project.client?.name || '',
          excelClient,
          excelProject,
          matchType: 'fuzzy',
          confidence: 0.8
        };
      }
    }
    
    return null;
  }
  
  /**
   * Create and insert project aliases from mappings
   */
  private async createAliasesFromMappings(mappings: ProjectMapping[]) {
    const aliases = [];
    
    for (const mapping of mappings) {
      const alias = {
        projectId: mapping.projectId,
        excelClient: mapping.excelClient,
        excelProject: mapping.excelProject,
        source: 'migration' as const,
        confidence: mapping.confidence,
        isActive: true,
        notes: `Migrated from ${mapping.matchType} match. Project: ${mapping.projectName}`
      };
      
      aliases.push(alias);
    }
    
    // Insert all aliases
    if (aliases.length > 0) {
      await db.insert(projectAliases).values(aliases);
      console.log(`📝 Inserted ${aliases.length} aliases into project_aliases table`);
    }
    
    return aliases;
  }
  
  /**
   * Print migration summary
   */
  private async printMigrationSummary() {
    const aliasCount = await db.select().from(projectAliases);
    
    console.log('\n🎯 MIGRATION SUMMARY:');
    console.log(`   Total aliases created: ${aliasCount.length}`);
    console.log(`   Exact matches: ${aliasCount.filter(a => a.confidence === 1.0).length}`);
    console.log(`   Fuzzy matches: ${aliasCount.filter(a => a.confidence < 1.0).length}`);
    console.log(`   Active aliases: ${aliasCount.filter(a => a.isActive).length}`);
    
    // Group by project
    const byProject = aliasCount.reduce((acc, alias) => {
      acc[alias.projectId] = (acc[alias.projectId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    console.log('\n📊 ALIASES BY PROJECT:');
    for (const [projectId, count] of Object.entries(byProject)) {
      console.log(`   Project ${projectId}: ${count} aliases`);
    }
  }
}

// CLI execution
async function runMigration() {
  const migrator = new FuzzyToAliasesMigrator();
  try {
    await migrator.migrate();
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}