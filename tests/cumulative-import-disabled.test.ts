import { expect, it } from 'vitest';
import { importRendimientoCliente } from '../server/etl/rendimiento-cliente';
it('refuses to turn cumulative budgets into monthly accounting facts', async () => {
  await expect(importRendimientoCliente()).rejects.toThrow('seguimiento acumulado');
});
