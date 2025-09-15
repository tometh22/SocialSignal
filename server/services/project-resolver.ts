/**
 * Resolutor universal de proyectos
 * Mapea projectId → projectKey sin hardcodes
 */

import projectsByKey from '../../shared/config/projects.json';
import idMap from '../../shared/config/project-id-map.json';

export type ProjectConfig = typeof projectsByKey[keyof typeof projectsByKey];

export function resolveProject(input: { projectId?: string | number; projectKey?: string }): ProjectConfig {
  const key = input.projectKey ?? (input.projectId != null ? (idMap as any)[String(input.projectId)] : undefined);
  
  if (!key) {
    throw new Error(`Unknown project (id=${input.projectId}, key=${input.projectKey}). Available IDs: ${Object.keys(idMap).join(', ')}`);
  }
  
  const cfg = (projectsByKey as any)[key];
  if (!cfg) {
    throw new Error(`Missing config for key=${key}. Available keys: ${Object.keys(projectsByKey).join(', ')}`);
  }
  
  console.log(`🔗 Resolved project ${input.projectId} → key="${key}" → spreadsheet="${cfg.spreadsheetId.substring(0, 10)}..."`);
  
  return cfg;
}