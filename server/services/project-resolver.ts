/**
 * Resolutor universal de proyectos - UNIFICADO
 * Usa project-config.ts como única fuente de configuración
 * Elimina imports estáticos para permitir dynamic reloading
 */

import { getProjectConfig, loadProjectConfigs } from '../../shared/utils/project-config.js';
import idMap from '../../shared/config/project-id-map.json';

export type ProjectConfig = ReturnType<typeof getProjectConfig>;

export function resolveProject(input: { projectId?: string | number; projectKey?: string }): ProjectConfig {
  const key = input.projectKey ?? (input.projectId != null ? (idMap as any)[String(input.projectId)] : undefined);
  
  if (!key) {
    throw new Error(`Unknown project (id=${input.projectId}, key=${input.projectKey}). Available IDs: ${Object.keys(idMap).join(', ')}`);
  }
  
  // 🚀 ARCHITECT FIX: Usar project-config.ts como única fuente
  const cfg = getProjectConfig(key);
  if (!cfg) {
    const availableKeys = Object.keys(loadProjectConfigs());
    throw new Error(`Missing config for key=${key}. Available keys: ${availableKeys.join(', ')}`);
  }
  
  console.log(`🔗 Resolved project ${input.projectId} → key="${key}" → spreadsheet="${cfg.spreadsheetId.substring(0, 10)}..."`);
  
  return cfg;
}