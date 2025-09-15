/**
 * Tests unitarios para sistema universal de rankings
 * Validando participación correcta, agregación y cálculos
 */

import { computeParticipacion, computeRankings, filterByPeriod, UniversalRow } from '../rankings-universal.js';

describe('computeParticipacion - Agregación correcta por persona', () => {
  
  test('suma múltiples filas por persona mismo proyecto-mes', () => {
    const rows: UniversalRow[] = [
      {
        person: 'Juan',
        projectId: 'P1',
        year: 2025,
        month: 7,
        horasReal: 10,
        horasObjetivo: 12,
        horasFacturacion: 8,
        valorHoraARS: 1000,
        montoUSD: 0
      },
      {
        person: 'Juan', // misma persona, mismo mes
        projectId: 'P1', 
        year: 2025,
        month: 7,
        horasReal: 5,
        horasObjetivo: 6,
        horasFacturacion: 4,
        valorHoraARS: 1000,
        montoUSD: 0
      },
      {
        person: 'Maria',
        projectId: 'P1',
        year: 2025, 
        month: 7,
        horasReal: 15,
        horasObjetivo: 15,
        horasFacturacion: 10,
        valorHoraARS: 1500,
        montoUSD: 0
      }
    ];

    const { share, totals } = computeParticipacion(rows);
    
    // Juan debería tener (8+4)*1000 = 12,000 de peso total
    // Maria debería tener 10*1500 = 15,000
    // Total = 27,000
    
    const totalExpected = 27000;
    expect(totals.get('P1|2025-07')).toBe(totalExpected);
    
    // Participaciones
    expect(share.get('P1|2025-07|Juan')).toBeCloseTo(12000 / 27000, 6);
    expect(share.get('P1|2025-07|Maria')).toBeCloseTo(15000 / 27000, 6);
    
    // Suma de participaciones debe ser ≈ 1
    const sumShares = (share.get('P1|2025-07|Juan') ?? 0) + (share.get('P1|2025-07|Maria') ?? 0);
    expect(sumShares).toBeCloseTo(1, 6);
  });

  test('casos con total=0 no rompen el sistema', () => {
    const rows: UniversalRow[] = [
      {
        person: 'Zero',
        projectId: 'P0',
        year: 2025,
        month: 7,
        horasReal: 0,
        horasObjetivo: 0,
        horasFacturacion: 0,
        valorHoraARS: 0,
        montoUSD: 0
      }
    ];

    const { share, totals } = computeParticipacion(rows);
    
    expect(totals.get('P0|2025-07')).toBe(0);
    expect(share.get('P0|2025-07|Zero')).toBe(0);
  });
});

describe('computeRankings - Cálculos universales', () => {
  
  test('cálculos básicos de eficiencia, impacto y unificado', () => {
    const rows: UniversalRow[] = [
      {
        person: 'Test',
        projectId: 'P1',
        year: 2025,
        month: 7,
        horasReal: 8,        // L = 8
        horasObjetivo: 10,   // K = 10
        horasFacturacion: 8,
        valorHoraARS: 1000,
        montoUSD: 0
      }
    ];

    const rankings = computeRankings(rows);
    
    expect(rankings).toHaveLength(1);
    
    const test = rankings[0];
    expect(test.person).toBe('Test');
    
    // Eficiencia = L/K * 100 = 8/10 * 100 = 80%
    expect(test.eficiencia).toBe(80);
    
    // Participación = 100% (único), eficiencia normalizada = 0.8
    // Impacto = 0.8 * 1.0 * 30 = 24
    expect(test.impacto).toBe(24);
    
    // Unificado = 0.5 * 80 + 0.5 * (24/30*100) = 40 + 40 = 80
    expect(test.unificado).toBe(80);
  });

  test('caso sin objetivo (K=0) usa eficiencia 70', () => {
    const rows: UniversalRow[] = [
      {
        person: 'NoGoal',
        projectId: 'P1',
        year: 2025,
        month: 7,
        horasReal: 10,
        horasObjetivo: 0,    // Sin objetivo
        horasFacturacion: 8,
        valorHoraARS: 1000,
        montoUSD: 0
      }
    ];

    const rankings = computeRankings(rows);
    
    const noGoal = rankings[0];
    expect(noGoal.eficiencia).toBe(70); // Default para K=0
    
    // Para impacto: effNorm = 1 cuando K=0
    // Impacto = 1 * 1.0 * 30 = 30
    expect(noGoal.impacto).toBe(30);
    
    // Unificado = 0.5 * 70 + 0.5 * (30/30*100) = 35 + 50 = 85
    expect(noGoal.unificado).toBe(85);
  });

  test('ordenamiento correcto: Unificado → Impacto → Eficiencia', () => {
    const rows: UniversalRow[] = [
      // Persona A: alta eficiencia, baja participación
      {
        person: 'A',
        projectId: 'P1',
        year: 2025,
        month: 7,
        horasReal: 10,
        horasObjetivo: 10,
        horasFacturacion: 2, // baja facturación = baja participación
        valorHoraARS: 1000,
        montoUSD: 0
      },
      // Persona B: baja eficiencia, alta participación  
      {
        person: 'B',
        projectId: 'P1',
        year: 2025,
        month: 7,
        horasReal: 5,
        horasObjetivo: 10,
        horasFacturacion: 8, // alta facturación = alta participación
        valorHoraARS: 1000,
        montoUSD: 0
      }
    ];

    const rankings = computeRankings(rows);
    
    // Debe estar ordenado por unificado descendente
    expect(rankings[0].unificado).toBeGreaterThanOrEqual(rankings[1].unificado);
    
    // Verificar que es determinístico
    const rankings2 = computeRankings(rows);
    expect(rankings).toEqual(rankings2);
  });
});

describe('filterByPeriod - Filtro temporal único', () => {
  
  test('filtra correctamente por rango yyyy-mm', () => {
    const rows: UniversalRow[] = [
      { person: 'A', projectId: 'P1', year: 2025, month: 6, horasReal: 10, horasObjetivo: 10, horasFacturacion: 8, valorHoraARS: 1000 },
      { person: 'B', projectId: 'P1', year: 2025, month: 7, horasReal: 10, horasObjetivo: 10, horasFacturacion: 8, valorHoraARS: 1000 },
      { person: 'C', projectId: 'P1', year: 2025, month: 8, horasReal: 10, horasObjetivo: 10, horasFacturacion: 8, valorHoraARS: 1000 },
    ];

    const filtered = filterByPeriod(rows, { start: '2025-06', end: '2025-07' });
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.person).sort()).toEqual(['A', 'B']);
  });

  test('maneja meses en formato string (jul, ago)', () => {
    const rows: UniversalRow[] = [
      { person: 'A', projectId: 'P1', year: 2025, month: 'jul', horasReal: 10, horasObjetivo: 10, horasFacturacion: 8, valorHoraARS: 1000 },
      { person: 'B', projectId: 'P1', year: 2025, month: 'ago', horasReal: 10, horasObjetivo: 10, horasFacturacion: 8, valorHoraARS: 1000 },
    ];

    const filtered = filterByPeriod(rows, { start: '2025-07', end: '2025-07' });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].person).toBe('A');
  });
});