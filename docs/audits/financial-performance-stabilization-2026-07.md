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

La base siguió creciendo durante la intervención. El corte definitivo previo al
saneamiento encontró 23.032 filas de Activo y 275.284 de Pasivo para
junio/julio. Todas las filas importadas de junio habían sido creadas durante
julio y correspondían al mismo ledger repetido.

La causa era una sincronización cada 30 minutos que:

- importaba Activo y Pasivo para el mes actual y el anterior;
- asignaba filas sin fecha al período solicitado;
- insertaba nuevamente Activo sin factura y Pasivo sin fecha;
- entregaba tablas completas y calculaba resúmenes en memoria;
- enriquecía proyectos con consultas por proyecto.

## Correcciones implementadas

- Parser determinista para snapshots de Activo y Pasivo.
- Contrato exacto de las hojas productivas: `Mes` + `Año`, meses en español,
  seriales de fecha de Sheets y encabezados `Moneda original ARS/USD`.
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
- `npm test`: 120 aprobados, 11 omitidos por configuración existente.
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

### Respaldo y saneamiento

- Backup lógico anterior al saneamiento:
  `.context/backups/mind-prod-before-ledger-20260728.dump`.
- Tamaño: 812 KB.
- SHA-256:
  `909c568ac60c543ca792d4dab4e558251923fefe036a7288a31fd8dd5e2f901e`.
- Archivo SQL recuperable durante 30 días:
  `activo_entries_archive_202607` y `pasivo_entries_archive_202607`.
- Archivadas: 23.032 filas de Activo y 275.284 de Pasivo.
- Junio importado eliminado; no existían filas manuales que preservar.
- Marcador idempotente:
  `0032_ledger_snapshot_performance_202607`.
- Rollback documentado en
  `scripts/restore-ledger-cleanup-202607.sql`.

### Reconstrucción canónica de julio

El primer intento de lectura fresca fue rechazado sin escribir porque el parser
inicial no reconocía el contrato real de producción. Se corrigió el contrato, se
agregaron fixtures fieles a las hojas y se desplegó el ajuste antes de reintentar.

| Dataset | Antes | Archivadas | Después | Claves estables | Total USD corregido |
|---|---:|---:|---:|---:|---:|
| Activo junio | 11.528 | 11.528 | 0 | 0 | 0 |
| Activo julio | 11.504 | 11.504 | 5 | 5 | 45.621,17 |
| Pasivo junio | 137.771 | 137.771 | 0 | 0 | 0 |
| Pasivo julio | 137.513 | 137.513 | 108 | 108 | 4.808,49 |

La segunda sincronización idéntica mantuvo exactamente 5 y 108 filas, un solo
batch vigente por dataset y los mismos totales. Preservó 5/5 identidades de
Activo y 108/108 de Pasivo; el estado final informado por la hoja quedó en
0 cobradas y 108 pagadas.

### Rendimiento posterior

Medición con `EXPLAIN (ANALYZE, BUFFERS)` sobre producción:

| Operación | Ejecución PostgreSQL | Payload de página |
|---|---:|---:|
| Activo, listado | 0,065 ms | 1.457 B |
| Pasivo, listado de 50 | 0,191 ms | 13.598 B |
| Activo, resumen | 0,057 ms | — |
| Pasivo, resumen | 0,100 ms | — |

Los cuatro resultados quedan ampliamente por debajo de 500/300 ms y 250 KB.
Railway sirvió el shell público en 5–36 ms de backend; la latencia total
observada desde Buenos Aires hacia `us-west2` fue 1,7–2,3 s y corresponde
principalmente a red/edge, no a procesamiento de la aplicación.

No hubo respuestas HTTP 5xx del despliegue durante el smoke test. Los endpoints
protegidos respondieron 401 correctamente sin sesión.

### Entrega

- Implementación principal: commit `990f4192`, PR
  [#160](https://github.com/tometh22/SocialSignal/pull/160), merge
  `dea306835c6256216348469d1a509f43b82689bf`.
- Ajuste al contrato real de Sheets: commit `3ef0bd9a`, PR
  [#161](https://github.com/tometh22/SocialSignal/pull/161), merge
  `730951437f3a78794cd654d45a5d1c26540cfe94`.
- Observabilidad, normalización manual e informe productivo: commit
  `e9eb93cd`, PR
  [#162](https://github.com/tometh22/SocialSignal/pull/162), merge
  `58569bc1669a702aef60573f13625ba81afdd616`.
- Railway: servicio `mind-epical-web`, deployment
  `f4a6b6d5-4e57-40be-9986-dd1b6ebb61a1`, estado `SUCCESS`.

### Monitoreo de estabilidad

La ventana se ejecutó del `2026-07-28T02:53:02Z` al
`2026-07-28T03:58:07Z` (65 minutos completos).

- Ciclo automático `03:21:49Z`: Activo 5/5 y Pasivo 108/108, todos los
  estados preservados, cero errores.
- Ciclo automático `03:51:50Z`: Activo 5/5 y Pasivo 108/108, todos los
  estados preservados, cero errores.
- Corte final `03:58:24Z`: 5 filas de Activo, 108 de Pasivo, un batch vigente
  por dataset y totales sin cambios.
- Cero respuestas HTTP 5xx durante los 70 minutos consultados.

### Validaciones pendientes o deuda observada

- El E2E visual autenticado no pudo repetirse en producción porque esta sesión
  no dispone de un navegador in-app conectado ni de una sesión de usuario. No
  se creó ni extrajo una credencial de producción para eludir autenticación.
- El pipeline ETL legacy de proyectos confirmados continúa registrando errores
  de `ON CONFLICT` por una restricción faltante. No afectó el ledger ni produjo
  5xx en el smoke financiero, pero debe tratarse como deuda independiente.
