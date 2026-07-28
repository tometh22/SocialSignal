# Estabilización financiera y de Home — registro de ejecución

Fecha: 2026-07-28
Rama de trabajo: `tometh22/auditar-feedback-mind-v2`

## Diagnóstico confirmado

Antes del cambio, producción presentaba:

| Recurso | Tiempo backend observado | Transferencia observada |
|---|---:|---:|
| `/api/activo` | 328 ms | 5.9 MB |
| `/api/pasivo` | 3.374 ms | 65.3 MB |
| `/api/pasivo/summary` | 769 ms | 546 B |
| `/api/v2/executive/dashboard` | 559 ms | respuesta pequeña |
| `/api/active-projects` | 3.500 ms | HTTP 500 |

La base acumulaba aproximadamente 22.900 filas de Activo y 274.000 de Pasivo
para junio/julio, aunque los snapshots contenían sólo 57 y 188 identidades
naturales respectivamente. Todas las filas de junio habían sido importadas
durante julio y compartían el mismo conjunto con julio.

La causa era una sincronización cada 30 minutos que:

- importaba Activo y Pasivo para el mes actual y el anterior;
- asignaba filas sin fecha al período solicitado;
- insertaba nuevamente Activo sin factura y Pasivo sin fecha;
- entregaba tablas completas y calculaba resúmenes en memoria;
- enriquecía proyectos con consultas por proyecto.

## Correcciones implementadas

- Parser determinista para snapshots de Activo y Pasivo.
- Identidad `source_row_key`, índice único parcial y sincronización transaccional.
- Importación de snapshots únicamente para el período actual.
- Preservación de filas manuales y estados cobrado/pagado.
- Listados paginados a 50 filas, con límite de 100.
- Agregaciones financieras y conversión USD ejecutadas en PostgreSQL.
- UI con paginación, skeletons, errores recuperables y tablas responsivas.
- Caché de Dashboard Ejecutivo: 5 minutos, single-flight y stale por una hora.
- Endpoint batched `/api/projects/alerts-summary`.
- Eliminación del enriquecimiento N+1 en el endpoint legacy de proyectos.
- Migración de archivo y saneamiento idempotente, más rollback explícito.

## Evidencia previa al despliegue

- `npm run check`: aprobado.
- `npm test`: 116 aprobados, 11 omitidos por configuración.
- `npm run build`: aprobado.
- Tests nuevos:
  - snapshots sin período;
  - rechazo de períodos explícitos incorrectos;
  - filas repetidas legítimas;
  - estabilidad de identidad;
  - períodos civiles;
  - single-flight;
  - stale ante caída de Sheets;
  - Home sin descarga de `/api/active-projects`.
- Migración PostgreSQL 16 aislada:
  - archivó 3 filas importadas de cada ledger;
  - eliminó junio sin tocar registros manuales;
  - consolidó julio y preservó estados positivos;
  - registró el marcador idempotente;
  - el rollback restauró exactamente junio/julio y reajustó secuencias.

## Resultados de producción

Pendiente de completar después del despliegue controlado:

- snapshot/backup;
- filas archivadas y canónicas;
- tiempos y tamaños posteriores;
- smoke test autenticado;
- estabilidad durante dos ciclos de sincronización;
- commit, PR, merge y deployment.
