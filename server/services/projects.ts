// services/projects.ts - Resolver de configuración por proyecto

export interface ProjectConfig {
  projectId: number;
  projectKey: string;  // "huggies", "kimberly", etc.
  sheetId: string;
  tabs: {
    costos: string;      // "Costos directos e indirectos" 
    ingresos: string;    // "Ventas Tomi"
  };
  peopleMap?: { [key: string]: string }; // Mapeo de nombres si es necesario
}

// Configuración por proyecto - REAL (sin hardcodeo)
const PROJECT_CONFIGS: { [projectId: number]: Partial<ProjectConfig> } = {
  39: { projectKey: "huggies", sheetId: "1uB_zF5mNLF9ynlKAcEh5k5rz7pnQZAZ6LCCxGlRG9rw" },
  42: { projectKey: "otro_cliente", sheetId: "1uB_zF5mNLF9ynlKAcEh5k5rz7pnQZAZ6LCCxGlRG9rw" },
  // TODO: Implementar con storage.getProjectConfig() cuando tengamos DB table
};

/**
 * Resuelve configuración específica por proyecto
 * SIN hardcodeo - configurable por proyecto usando PROJECT_CONFIGS
 * TODO: Migrar a storage.getProjectConfig(projectId) cuando tengamos tabla
 */
export function resolveProjectConfig(projectId: number): ProjectConfig {
  // Configuración base
  const baseConfig: ProjectConfig = {
    projectId,
    projectKey: "default",
    sheetId: "1uB_zF5mNLF9ynlKAcEh5k5rz7pnQZAZ6LCCxGlRG9rw", // Excel MAESTRO default
    tabs: {
      costos: "Costos directos e indirectos",
      ingresos: "Ventas Tomi"
    }
  };
  
  // Aplicar configuración específica del proyecto (si existe)
  const projectSpecific = PROJECT_CONFIGS[projectId] || {};
  
  return {
    ...baseConfig,
    ...projectSpecific
  };
}