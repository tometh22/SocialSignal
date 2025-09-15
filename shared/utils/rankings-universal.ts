/**
 * Sistema universal de rankings económicos
 * Funciona para cualquier proyecto con participación correcta y cálculos robustos
 */

import { parseDec, normMonth } from './num.js';

export type UniversalRow = {
  person: string;
  projectId: string;
  year: number | string;
  month: number | string; // "jul" o 7
  horasReal: unknown;         // L
  horasObjetivo: unknown;     // K  
  horasFacturacion: unknown;  // M
  valorHoraARS: unknown;      // N
  montoUSD?: unknown;         // R (opcional)
};

export type UniversalPeriod = { 
  start: string; // 'yyyy-mm'
  end: string;   // 'yyyy-mm' (inclusive)
};

export type UniversalRankingResult = {
  person: string;
  eficiencia: number;
  impacto: number;
  unificado: number;
  horasReal: number;
  horasObjetivo: number;
};

/**
 * Calcula participación correcta sumando todas las filas por persona
 * dentro de cada proyecto-mes (no solo la última fila)
 */
export function computeParticipacion(rows: UniversalRow[]) {
  // 1) agrego pesos por persona dentro de cada proyecto-mes
  const group = new Map<string, Map<string, number>>(); // key -> person -> peso
  const totals = new Map<string, number>();             // key -> total peso

  for (const r of rows) {
    const key = `${r.projectId}|${r.year}-${String(normMonth(r.month)).padStart(2, "0")}`;
    const M = Math.max(0, parseDec(r.horasFacturacion));
    const VH = Math.max(0, parseDec(r.valorHoraARS));
    const USD = Math.max(0, parseDec(r.montoUSD));
    const peso = USD > 0 ? USD : (M * VH);

    if (!group.has(key)) group.set(key, new Map());
    const byPerson = group.get(key)!;
    byPerson.set(r.person, (byPerson.get(r.person) ?? 0) + peso);

    totals.set(key, (totals.get(key) ?? 0) + peso);
  }

  // 2) convierto a shares (0–1) por key/person
  const share = new Map<string, number>(); // `${key}|${person}` -> share
  for (const [key, byPerson] of group) {
    const total = Math.max(0, totals.get(key) ?? 0);
    for (const [person, pesoPers] of byPerson) {
      const s = total > 0 ? (pesoPers / total) : 0;
      share.set(`${key}|${person}`, s);
    }
  }
  
  return { share, totals };
}

/**
 * Calcula rankings universales con matemática correcta
 * Eficiencia, Impacto, Unificado por persona (suma de filas)
 */
export function computeRankings(rows: UniversalRow[]): UniversalRankingResult[] {
  // Filtrado temporal ya aplicado (ver filterByPeriod)
  const { share } = computeParticipacion(rows);

  // Eficiencia, Impacto, Unificado por persona (suma de filas)
  const agg = new Map<string, {
    K: number; 
    L: number; 
    M: number; 
    pesoImpacto: number; 
    impacto: number;
  }>();

  for (const r of rows) {
    const person = r.person;
    const K = parseDec(r.horasObjetivo);
    const L = parseDec(r.horasReal);
    const key = `${r.projectId}|${r.year}-${String(normMonth(r.month)).padStart(2, "0")}`;

    const effNorm = K === 0 ? 1 : Math.min(1, Math.max(0, L / K));
    const s = share.get(`${key}|${person}`) ?? 0;
    const impactoFila = effNorm * s * 30;

    if (!agg.has(person)) {
      agg.set(person, { K: 0, L: 0, M: 0, pesoImpacto: 0, impacto: 0 });
    }
    const a = agg.get(person)!;
    a.K += K; 
    a.L += L; 
    a.impacto += impactoFila;
  }

  // Genero scores
  return [...agg.entries()].map(([person, a]) => {
    const effScore = a.K === 0 ? 70 : Math.min(1, a.L / a.K) * 100;
    const impacto = a.impacto;                     // 0–30 ya sumado
    const unif = 0.5 * effScore + 0.5 * (impacto / 30 * 100);
    
    return { 
      person, 
      eficiencia: effScore, 
      impacto, 
      unificado: unif,
      horasReal: a.L,
      horasObjetivo: a.K
    };
  }).sort((x, y) =>
    y.unificado - x.unificado || y.impacto - x.impacto || y.eficiencia - x.eficiencia
  );
}

/**
 * Filtro temporal único que normaliza mes/año y filtra consistentemente
 */
export function filterByPeriod(rows: UniversalRow[], p: UniversalPeriod): UniversalRow[] {
  const toKey = (r: UniversalRow) => `${r.year}-${String(normMonth(r.month)).padStart(2, "0")}`;
  
  return rows.filter(r => {
    const k = toKey(r);
    return k >= p.start && k <= p.end;
  });
}