import Fuse from 'fuse.js';
import { db } from '../db';
import { dimClientAlias, dimProjectAlias, rcUnmatchedStaging, activeProjects } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * SOT PROJECT RESOLVER V2 - Deterministic + Fuzzy Matching
 * 
 * Sistema completo de resolución de proyectos con 3 etapas:
 * 1. Cliente: Exact match → Fuzzy (≥0.92)
 * 2. Proyecto: Exact match → Token subset → Fuzzy (≥0.92)
 * 3. Staging: Guardar unmatched para auditoría
 * 
 * Orden de ejecución:
 * - Normalizar cliente y proyecto con normKey()
 * - Resolver clientId desde dim_client_alias o activeProjects
 * - Resolver projectId usando clientId + dim_project_alias
 * - Si falla, guardar en rc_unmatched_staging
 */

const FUZZY_THRESHOLD = 0.92;

/**
 * Normalización determinística de strings para matching
 * - Lowercase
 * - Remove accents/diacritics
 * - Remove special chars excepto espacios
 * - Trim y collapse múltiples espacios
 */
export function normKey(str: string | null | undefined): string {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Cache en memoria para optimizar consultas repetitivas
 */
interface ResolverCache {
  clientAliases: Map<string, number | null>; // normKey → clientId
  projectAliases: Map<string, number>; // clientId:normKey → projectId
  allProjects: Array<{ 
    id: number; 
    clientId: number;
    clientName: string; 
    projectName: string; 
  }>;
}

let cache: ResolverCache | null = null;

/**
 * Inicializar cache con datos de la DB
 */
async function initCache(): Promise<ResolverCache> {
  const [clientAliasRows, projectAliasRows, projectRows] = await Promise.all([
    db.select().from(dimClientAlias),
    db.select().from(dimProjectAlias),
    db.query.activeProjects.findMany({
      with: {
        client: true,
        quotation: true,
      },
    }),
  ]);

  const clientAliases = new Map<string, number | null>();
  clientAliasRows.forEach(row => {
    clientAliases.set(row.aliasNorm, row.clientId);
  });

  const projectAliases = new Map<string, number>();
  projectAliasRows.forEach(row => {
    const key = `${row.clientId}:${row.aliasNorm}`;
    projectAliases.set(key, row.projectId);
  });

  const allProjects = projectRows.map(p => ({
    id: p.id,
    clientId: p.clientId,
    clientName: p.client?.name || '',
    projectName: p.quotation?.projectName || p.subprojectName || '',
  }));

  return {
    clientAliases,
    projectAliases,
    allProjects,
  };
}

/**
 * Obtener cache, inicializando si es necesario
 */
async function getCache(): Promise<ResolverCache> {
  if (!cache) {
    cache = await initCache();
  }
  return cache;
}

/**
 * Invalidar cache (llamar después de insertar nuevos alias)
 */
export function invalidateCache(): void {
  cache = null;
}

/**
 * ETAPA 1: Resolver clientId desde clienteRaw
 * 
 * Orden:
 * 1. Exact match en dim_client_alias
 * 2. Fuzzy match contra activeProjects.clientName (≥0.92)
 * 3. Si match fuzzy exitoso → auto-crear alias en dim_client_alias
 * 
 * @returns clientId o null si no hay match
 */
export async function resolveClientId(
  clienteRaw: string
): Promise<{ clientId: number | null; fuzzyScore?: number; isNewAlias?: boolean }> {
  const clienteNorm = normKey(clienteRaw);
  if (!clienteNorm) return { clientId: null };

  const c = await getCache();

  // 1. Exact match en cache
  if (c.clientAliases.has(clienteNorm)) {
    return { clientId: c.clientAliases.get(clienteNorm)! };
  }

  // 2. Fuzzy match contra todos los proyectos (por clientName)
  const uniqueClients = Array.from(
    new Map(c.allProjects.map(p => [p.clientName, p.clientId])).entries()
  ).map(([name, id]) => ({ id, name: normKey(name) }));

  const fuse = new Fuse(uniqueClients, {
    keys: ['name'],
    threshold: 1 - FUZZY_THRESHOLD,
    includeScore: true,
  });

  const results = fuse.search(clienteNorm);
  
  if (results.length > 0 && results[0].score !== undefined) {
    const matchScore = 1 - results[0].score;
    
    if (matchScore >= FUZZY_THRESHOLD) {
      const matchedClientId = results[0].item.id;
      
      // Auto-crear alias en dim_client_alias
      await db.insert(dimClientAlias).values({
        aliasNorm: clienteNorm,
        clientId: matchedClientId,
        clientRaw: clienteRaw,
        source: 'auto_fuzzy',
      }).onConflictDoNothing();
      
      invalidateCache(); // Invalidar para refrescar en próxima consulta
      
      return { 
        clientId: matchedClientId, 
        fuzzyScore: matchScore,
        isNewAlias: true,
      };
    }
  }

  return { clientId: null };
}

/**
 * ETAPA 2: Resolver projectId usando clientId + proyectoRaw
 * 
 * Orden (con clientId):
 * 1. Exact match en dim_project_alias
 * 2. Token subset match único (todos los tokens de búsqueda están en candidato)
 * 3. Fuzzy match contra activeProjects filtrado por clientId (≥0.92)
 * 4. Si match exitoso → auto-crear alias en dim_project_alias
 * 
 * @returns projectId o null si no hay match
 */
export async function resolveProjectId(
  clientId: number | null,
  proyectoRaw: string
): Promise<{ 
  projectId: number | null; 
  fuzzyScore?: number; 
  matchType?: 'exact' | 'token_subset' | 'fuzzy';
  isNewAlias?: boolean;
}> {
  const proyectoNorm = normKey(proyectoRaw);
  if (!proyectoNorm) return { projectId: null };

  const c = await getCache();

  // 1. Exact match en cache
  const exactKey = `${clientId}:${proyectoNorm}`;
  if (c.projectAliases.has(exactKey)) {
    return { 
      projectId: c.projectAliases.get(exactKey)!, 
      matchType: 'exact',
    };
  }

  // Filtrar proyectos por clientId (si existe)
  const candidateProjects = clientId
    ? c.allProjects.filter(p => p.clientId === clientId)
    : c.allProjects;

  // 2. Token subset match
  const queryTokens = proyectoNorm.split(' ').filter(t => t.length > 0);
  
  const tokenMatches = candidateProjects.filter(p => {
    const projectTokens = normKey(p.projectName).split(' ');
    return queryTokens.every(qt => projectTokens.some(pt => pt.includes(qt)));
  });

  if (tokenMatches.length === 1) {
    const matchedProject = tokenMatches[0];
    
    // Auto-crear alias
    await db.insert(dimProjectAlias).values({
      clientId,
      aliasNorm: proyectoNorm,
      projectId: matchedProject.id,
      projectRaw: proyectoRaw,
      source: 'auto_token_subset',
    }).onConflictDoNothing();
    
    invalidateCache();
    
    return { 
      projectId: matchedProject.id, 
      matchType: 'token_subset',
      isNewAlias: true,
    };
  }

  // 3. Fuzzy match
  const fuseProjects = candidateProjects.map(p => ({
    id: p.id,
    name: normKey(p.projectName),
  }));

  const fuse = new Fuse(fuseProjects, {
    keys: ['name'],
    threshold: 1 - FUZZY_THRESHOLD,
    includeScore: true,
  });

  const results = fuse.search(proyectoNorm);
  
  if (results.length > 0 && results[0].score !== undefined) {
    const matchScore = 1 - results[0].score;
    
    if (matchScore >= FUZZY_THRESHOLD) {
      const matchedProjectId = results[0].item.id;
      
      // Auto-crear alias
      await db.insert(dimProjectAlias).values({
        clientId,
        aliasNorm: proyectoNorm,
        projectId: matchedProjectId,
        projectRaw: proyectoRaw,
        source: 'auto_fuzzy',
      }).onConflictDoNothing();
      
      invalidateCache();
      
      return { 
        projectId: matchedProjectId, 
        fuzzyScore: matchScore,
        matchType: 'fuzzy',
        isNewAlias: true,
      };
    }
  }

  return { projectId: null };
}

/**
 * ETAPA 3: Guardar RC sin match en staging para auditoría
 */
export async function logUnmatchedRC(params: {
  periodKey: string;
  clienteRaw: string;
  proyectoRaw: string;
  motivo: 'unknown_client' | 'unknown_project' | 'ambiguous_project' | 'below_threshold';
  fuzzyScore?: number;
  candidateProjectId?: number;
}): Promise<void> {
  const clienteNorm = normKey(params.clienteRaw);
  const proyectoNorm = normKey(params.proyectoRaw);

  await db.insert(rcUnmatchedStaging).values({
    periodKey: params.periodKey,
    clienteRaw: params.clienteRaw,
    proyectoRaw: params.proyectoRaw,
    clienteNorm,
    proyectoNorm,
    motivo: params.motivo,
    fuzzyScore: params.fuzzyScore,
    candidateProjectId: params.candidateProjectId,
  });
}

/**
 * Flujo completo de resolución para una fila RC
 * 
 * @returns { projectId, diagnostics } - projectId o null + info de diagnóstico
 */
export async function resolveRCRow(
  periodKey: string,
  clienteRaw: string,
  proyectoRaw: string
): Promise<{
  projectId: number | null;
  diagnostics: {
    clientResolution?: { clientId: number | null; fuzzyScore?: number; isNewAlias?: boolean };
    projectResolution?: { projectId: number | null; fuzzyScore?: number; matchType?: string; isNewAlias?: boolean };
    motivo?: string;
  };
}> {
  // Etapa 1: Resolver cliente
  const clientResolution = await resolveClientId(clienteRaw);
  
  if (!clientResolution.clientId) {
    await logUnmatchedRC({
      periodKey,
      clienteRaw,
      proyectoRaw,
      motivo: 'unknown_client',
    });
    
    return {
      projectId: null,
      diagnostics: {
        clientResolution,
        motivo: 'unknown_client',
      },
    };
  }

  // Etapa 2: Resolver proyecto
  const projectResolution = await resolveProjectId(clientResolution.clientId, proyectoRaw);
  
  if (!projectResolution.projectId) {
    await logUnmatchedRC({
      periodKey,
      clienteRaw,
      proyectoRaw,
      motivo: 'unknown_project',
      candidateProjectId: clientResolution.clientId,
    });
    
    return {
      projectId: null,
      diagnostics: {
        clientResolution,
        projectResolution,
        motivo: 'unknown_project',
      },
    };
  }

  return {
    projectId: projectResolution.projectId,
    diagnostics: {
      clientResolution,
      projectResolution,
    },
  };
}
