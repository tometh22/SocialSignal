# Feedback Mind 6-10 — implementación

Fuente: `Feedback Mind V2-4.pdf`, recibido el 8 de octubre de 2026. Desarrollo sobre 1.11.12. Release 1.12.0 desplegado el 8 de octubre de 2026; parche 1.12.1 preparado durante la verificación productiva.

## Cambios

| Punto | Implementación |
| --- | --- |
| T1 | Calendario de rango con borrador local: primer clic conserva inicio, segundo guarda. Permite un día y conserva extremos parciales; cerrar el popover descarta el borrador. |
| T2–T3 | Selección independiente del check: casillas, modificadores, rangos por orden visible, Shift+flechas, Escape y Delete/Backspace. Confirmación común. API de borrado por proyecto, transacción y protección de horas nativas/importadas en todos los descendientes. El borrado individual usa el mismo servicio. |
| T4 | Paleta compartida por cliente, color neutral sin cliente y leyendas en calendarios. Estado mediante check, tachado y referencia de bloqueo. |
| T5 | API personal enriquecida con cliente/proyecto; referencias visibles en móvil. |
| T6–T9 | Fecha editable en carga rápida, corrección y diálogo del cronómetro. Presentación de fechas civiles sin conversión al día anterior. Hoy, semana y mes parten de Buenos Aires; fechas guardadas conservan su día civil, incluidas cargas legacy a medianoche. |
| T7 | Clasificación compartida por fechas; seis columnas en tablero, bloqueo prioritario en tablero y referencia en la clasificación personal. Motivo obligatorio en cliente y servidor. Finalización y recurrencias continúan por completion. |
| T8 | Cronómetro persistente en Topbar. En móvil ocupa una segunda fila del encabezado, con duración, título abreviado y Detener. |
| T10 | Alcance personal por responsable/colaboradores, sin inclusión por autor de tareas sin asignación. |
| C1 | Deduplicación entre fuentes uno a uno, conservando repeticiones legítimas. Reconstrucción mensual transaccional. Snapshots válidos conservados, incluidos FX referenciados. Costos pendientes/parciales visibles. Fallos de sincronización devuelven la carga guardada y un aviso; marca persistente incluso si se elimina la última entrada del mes. |
| C2 | Markup nullable; internos muestran No aplica y comerciales sin métricas muestran Sin datos. Salud neutral sin factores evaluables. Copilot no recomienda renegociar por un markup ausente. |
| C3 | Identidad operativa del proyecto antes de cotización/subproyecto; cliente y categoría en las variantes de complete-data. |
| I1 | Inicio y Tareas consumen my-hours. hours-summary y reconstrucción mensual comparten fuentes, fechas civiles y deduplicación. |
| I2 | Mi semana muestra horas semanales/mensuales, lunes a domingo actuales y enlace a Tareas; mantiene las demás tarjetas de Inicio. |
| A1 | Freelancers exentos de validación de cupos en aprobación/edición. Solicitudes y saldos muestran Sin cupo — freelance; la API rechaza configurarles un cupo. Workflow, auditoría, superposiciones y disponibilidad se conservan. |

## Migración y conciliación

Migración aditiva e idempotente: `migrations/0081_task_block_details.sql`. Agrega `tasks.blocked_reason`, `tasks.blocked_at` y `task_time_entries.cost_sync_pending`. El arranque del servidor ejecuta su equivalente en `server/migrations/task-block-details.ts`. Bloqueos históricos sin motivo muestran Motivo pendiente.

Con `DATABASE_URL` configurada, consultar primero la vista previa del período afectado:

```sh
npm run reconcile:task-costs -- 2026-10
```

La respuesta muestra bloqueos, snapshots propuestos y costos mensuales propuestos. No modifica snapshots ni contabilidad en esta modalidad. Para aplicar luego de revisar:

```sh
npm run reconcile:task-costs -- 2026-10 --apply
```

Sólo aplica en origen app, después del corte histórico configurado y con período financiero abierto. Origen Excel y períodos cerrados/en revisión quedan bloqueados. Las tarifas y FX faltantes permanecen pendientes. La conciliación reconstruye **todo el período** con deduplicación entre fuentes y conserva snapshots válidos. Snapshots y hechos mensuales se guardan en una misma transacción; un error revierte la operación. Las mutaciones de horas y los cierres financieros se coordinan por período.

Las marcas `task_cost_sync:YYYY-MM:projectId` en system_config señalan reconstrucciones pendientes, incluidas eliminaciones. Una reconstrucción exitosa las limpia dentro de la misma transacción. No son tarifas ni cupos.

## Validación local

- `npm test`: 853 tests aprobados, 11 omitidos; 73 archivos aprobados y uno omitido.
- `npm run check`: TypeScript sin errores.
- `npm run build`: cliente y servidor compilados. Advertencia de tamaño de bundles; no bloquea el build.
- `git diff --check`: sin errores.
- Nuevas regresiones: fechas civiles UTC/BA, domingo/lunes/cambio de mes, rangos de calendario, clasificación/bloqueo, deduplicación, salud sin métricas, protección de borrado nativa/importada y conciliación (vista previa, snapshots, Excel, corte, cierre y error de reconstrucción).
- QA en navegador con datos simulados: desktop y 390×844; rango en dos clics, selección por Shift+clic y Shift+flecha, Escape, Backspace, motivo obligatorio, reclasificación al bloquear, seis columnas y diálogo de cronómetro con fecha. Se corrigió un desbordamiento del cronómetro móvil.
- Capturas locales: `.context/feedback-desktop.png` y `.context/feedback-mobile.png`. El harness de QA temporal se retiró.

## Verificación productiva — 8 de octubre de 2026

El usuario autorizó el despliegue después de cerrar la validación local. La versión 1.12.0 pasó CI de checkout limpio y se mergeó en PR #307, commit `9970090f297932bbb9666d3c964cfa3a6710aaec`. Railway `mind-epical-web` marcó SUCCESS, deployment `ba216c87-7a8c-4716-ac12-795025407a86`; health respondió con ese commit. Migración 0081 comprobada por logs y columnas reales.

La conexión productiva se obtuvo en memoria desde Railway; no se guardaron credenciales en el workspace. El origen real es app y el corte histórico es 2026-08. Octubre no tiene cierre registrado. La vista previa mostró 12 registros mensuales, ninguna carga pendiente de tarifa/FX y dos acumulados discrepantes (proyectos 85 y 90). Se respaldaron los hechos del mes en .context y se aplicó la conciliación de octubre: 12 actualizados, cero insertados/eliminados y ningún error. La comparación posterior coincide en horas/costos con la vista previa; el hash de los snapshots y las cantidades de tareas/cargas permanecieron iguales.

Se comprobó con sesión autenticada: Inicio muestra 5–11 de octubre; Inicio y Tareas coinciden en horas personales; Cartera muestra 74 h; Epical General conserva su identidad, muestra No aplica para markup y salud neutral en su encabezado. La comprobación detectó que algunas filas de Cartera mostraban costo cero mientras el detalle mostraba el costo real: se actualizaba costUSD, pero quedaba costUSDNormalized anterior. El parche 1.12.1 reemplaza juntos los aliases financieros y agrega dos regresiones de comportamiento (moneda nativa/USD y ceros reales). Validación local del parche: 855 tests aprobados, 11 omitidos, TypeScript y build correctos.

Las pruebas transaccionales de concurrencia, períodos cerrados, origen Excel y fallos de reconstrucción usan mocks; no se alteraron tareas, horas ni solicitudes de ausencia para ensayar esas mutaciones en producción. La verificación de despliegue no sustituye ese conjunto de pruebas reales. Cada release actualiza VERSION, package.json y CHANGELOG.md juntos y pasa CI de checkout limpio antes del merge.
