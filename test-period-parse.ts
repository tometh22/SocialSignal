import { toPeriodKey } from './server/etl/sot-utils';

// Casos de test basados en la imagen del Excel
const tests = [
  { mes: "08 ago", año: "2025-8", desc: "Kimberly agosto (formato Excel)" },
  { mes: "08 ago", año: 2025, desc: "Kimberly agosto (número)" },
  { mes: "08 ago", año: "2025", desc: "Kimberly agosto (string)" },
  { mes: "Agosto", año: "2025", desc: "Agosto string" },
];

tests.forEach(t => {
  const result = toPeriodKey(t.mes, t.año);
  console.log(`${t.desc}: "${t.mes}" + "${t.año}" → "${result}"`);
});
