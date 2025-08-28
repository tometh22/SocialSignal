/**
 * Revenue Automation Service
 * 
 * This service handles automatic generation of monthly revenues for fee-based projects.
 * It runs periodically to ensure all projects have current revenue data.
 */

import { storage } from '../storage';

export class RevenueAutomationService {
  private storage: typeof storage;
  private isRunning = false;

  constructor(storageInstance: typeof storage) {
    this.storage = storageInstance;
  }

  /**
   * Start the revenue automation service
   * This will run the revenue generation on the first day of each month
   */
  start() {
    console.log('🤖 Revenue Automation Service started');
    
    // Check every hour if we need to run monthly generation
    setInterval(() => {
      this.checkAndRunMonthlyGeneration();
    }, 60 * 60 * 1000); // 1 hour
    
    // Run immediately on startup to catch up if needed
    setTimeout(() => {
      this.runRevenueGeneration();
    }, 5000); // 5 seconds after startup
  }

  /**
   * Check if we should run revenue generation (first day of month)
   */
  private async checkAndRunMonthlyGeneration() {
    const now = new Date();
    const isFirstDayOfMonth = now.getDate() === 1;
    const currentHour = now.getHours();
    
    // Run on first day of month between 6-7 AM
    if (isFirstDayOfMonth && currentHour === 6 && !this.isRunning) {
      console.log(`📅 First day of month detected: ${now.toISOString()}`);
      await this.runRevenueGeneration();
    }
  }

  /**
   * Run the full revenue generation process for all fee monthly projects
   */
  async runRevenueGeneration() {
    if (this.isRunning) {
      console.log('⏳ Revenue generation already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      console.log('🤖 Starting automatic revenue generation for all fee monthly projects...');
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      console.log(`📅 Generating revenues up to: ${currentMonth}/${currentYear}`);
      
      // Get all active projects
      const projects = await this.storage.getActiveProjects();
      console.log(`📊 Found ${projects.length} active projects`);
      
      let processedProjects = 0;
      let totalRevenuesCreated = 0;
      
      for (const project of projects) {
        try {
          // Process ALL active projects (no type restriction)
          if (!project.quotation) {
            console.log(`⚠️ Skipping project ${project.id} - no quotation found`);
            continue;
          }
          
          console.log(`💰 Processing project: ${project.quotation.projectName} (ID: ${project.id}) - Type: ${project.quotation.projectType}`);
          
          // Determine project start date
          const projectStartDate = project.quotation.createdAt ? new Date(project.quotation.createdAt) : new Date(2024, 0, 1);
          const startYear = projectStartDate.getFullYear();
          const startMonth = projectStartDate.getMonth() + 1;
          
          // Generate revenues from project start to current month using the new universal function
          const revenues = await this.storage.generateMonthlyRevenueForAnyProject(
            project.id,
            startYear,
            startMonth,
            currentYear,
            currentMonth
          );
          
          processedProjects++;
          totalRevenuesCreated += revenues.length;
          
          console.log(`✅ Created ${revenues.length} revenue records for project ${project.id}`);
          
        } catch (projectError: any) {
          console.error(`❌ Error processing project ${project.id}:`, projectError);
        }
      }
      
      console.log(`🎉 Auto-generation completed: ${processedProjects} projects processed, ${totalRevenuesCreated} total revenues created`);
      
    } catch (error: any) {
      console.error('❌ Error in automatic revenue generation:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for revenue generation (for UI button)
   */
  async triggerManualGeneration() {
    return this.runRevenueGeneration();
  }

  /**
   * Get the service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextScheduledRun: this.getNextScheduledRun()
    };
  }

  /**
   * Calculate when the next scheduled run will be
   */
  private getNextScheduledRun(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 6, 0, 0); // 6 AM on first of next month
    return nextMonth;
  }
}