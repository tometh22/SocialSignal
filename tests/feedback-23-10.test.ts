import { describe, it, expect } from 'vitest';
import { externalStageSchema, assertExternalQuotationStage } from '../shared/utils/quotation-external-stage';
import { personalTaskHours } from '../server/services/task-hour-privacy';

describe('23 October commercial stage registration', () => {
  it('allows a historical acceptance directly from draft, but prevents overwriting accepted or retired proposals', () => {
    expect(() => assertExternalQuotationStage('draft','approved')).not.toThrow();
    expect(() => assertExternalQuotationStage('pending','approved')).not.toThrow();
    for (const [from,to] of [['approved','sent'],['approved','approved'],['cancelled','approved'],['rejected','approved'],['in-negotiation','sent']]) {
      expect(() => assertExternalQuotationStage(from,to)).toThrow();
    }
  });
  it('requires a valid civil date, reference, current revision and concurrency version', () => {
    const valid = {stage:'approved',occurredOn:'2026-10-23',channel:'email',reason:'Aceptado por email',expectedRevisionNumber:2,expectedLockVersion:3};
    expect(externalStageSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [{occurredOn:'2026-02-30'},{reason:''},{expectedRevisionNumber:0},{expectedLockVersion:-1},{stage:'draft'},{channel:'unknown'}]) {
      expect(externalStageSchema.safeParse({...valid,...invalid}).success).toBe(false);
    }
  });
});
describe('personal hours inside shared projects', () => {
  const hours = new Map([[1,2],[2,0]]); const owners = new Map([[1,4],[2,5]]);
  it('does not expose colleagues entries or task totals even when a person can read the task', () => {
    const response = {id:2,title:'Compartida',assigneeId:5,loggedHours:99,estimatedHoursTotal:45,timeEntries:[{personnelId:4,hours:2},{personnelId:5,hours:97}],subtasks:[{id:1,title:'Mía',assigneeId:4,loggedHours:88,estimatedHoursTotal:3}]};
    const visible = personalTaskHours(response,4,hours,owners);
    expect(visible.loggedHours).toBe(0); expect(visible.estimatedHoursTotal).toBe(0);
    expect(visible.timeEntries).toEqual([{personnelId:4,hours:2}]);
    expect(visible.subtasks[0]).toMatchObject({loggedHours:2,estimatedHoursTotal:3});
    expect(response.timeEntries).toHaveLength(2);
  });
  it('does not expose weekly plans assigned to other people or any entries without a personnel identity', () => {
    expect(personalTaskHours([{taskId:1,weekStart:'2026-10-19',estimatedHours:3},{taskId:2,weekStart:'2026-10-19',estimatedHours:40}],4,hours,owners)).toHaveLength(1);
    expect(personalTaskHours([{personnelId:4,hours:2}],null,hours,owners)).toEqual([]);
  });
});
