import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock('../server/db',()=>({pool:{query:vi.fn()}}));
vi.mock('../server/services/revenue-basis',()=>({getRevenueByBasis:vi.fn()}));
import { pool } from '../server/db';
import { getRevenueByBasis } from '../server/services/revenue-basis';
import { getNativeProjectionSummary } from '../server/services/financial-native-dashboard';

describe('native projection completeness',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('keeps historical snapshots and marks incomplete native budgets as unknown',async()=>{
    vi.mocked(getRevenueByBasis).mockResolvedValue([
      {periodKey:'2026-07',devengado:999},
      {periodKey:'2026-10',devengado:1000},
      {periodKey:'2026-11',devengado:1000},
    ] as any);
    vi.mocked(pool.query).mockResolvedValueOnce({rows:[{period_key:'2026-07',total:20},{period_key:'2026-10',total:250},{period_key:'2026-11',total:null}]} as any)
      .mockResolvedValueOnce({rows:[{period_key:'2026-07',facturacion_total:100,costos_directos:70,costos_indirectos:30,ebit_operativo:0}]} as any);
    const result=await getNativeProjectionSummary(2026);
    expect(result.months[0]).toMatchObject({cierre:true,facturacion:100,costos:100,resultado:0});
    expect(result.months[1]).toMatchObject({cierre:false,costos:250,resultado:750});
    expect(result.months[2]).toMatchObject({costos:null,resultado:null});
    expect(result.costos).toEqual({ejecutado:100,proyectado:null,total:null});
    expect(result.pendingCostPeriods).toEqual(['2026-11']);
  });
  it('returns complete totals when each month has an explicit budget',async()=>{
    vi.mocked(getRevenueByBasis).mockResolvedValue([{periodKey:'2026-10',devengado:1000},{periodKey:'2026-11',devengado:0}] as any);
    vi.mocked(pool.query).mockResolvedValueOnce({rows:[{period_key:'2026-10',total:250},{period_key:'2026-11',total:100}]} as any).mockResolvedValueOnce({rows:[]} as any);
    const result=await getNativeProjectionSummary(2026);
    expect(result.costos.total).toBe(350);expect(result.resultado.total).toBe(650);
    expect(result.pendingCostPeriods).toEqual([]);
  });
});
