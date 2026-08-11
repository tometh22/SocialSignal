# Feedback Mind V2.7 — mapa de implementación

Fecha: 2026-08-10  
Fuente: `Feedback Mind V2-7.pdf` (11 páginas)

## Resultado

El feedback accionable quedó aplicado en Personal, Cotizaciones, Proyectos, Tareas, Horas y Capacidad. Se preservaron sin cambios las decisiones que el documento marca como pendientes de definición: la reclasificación automática de tareas y el circuito completo de ausencias.

## Mapa de fixes

| Área | Feedback | Implementación | Estado |
|---|---|---|---|
| Personal | La tabla mensual estaba fijada a 2025 y mezclaba historial con futuro | Selector dinámico de año (pasado, presente y próximo), lectura/escritura sobre `personnel_historical_costs` y textos renombrados a “historial y proyección” | Aplicado |
| Personal | Faltaban rol y subnivel | Rol vigente/histórico y subnivel reparados desde roles existentes, visibles y editables desde Personal; freelancers conservan subnivel | Aplicado y normalizado |
| Nueva cotización | Información básica y selectores desalineados | Layout centrado y responsive para información básica, mes de sueldo, proyección y filas del equipo; stepper centrado con scroll seguro | Aplicado |
| Nueva cotización | Personal con tarifa USD aparecía como ARS 0 | Historial contractual USD normalizado, grilla por moneda de facturación y conversión con FX mensual o `usd_exchange_rate`; variantes evitan doble conversión | Aplicado y normalizado |
| Nueva cotización | El selector final podía cambiar la moneda sin recalcular el equipo | Todos los selectores usan el mismo recálculo, snapshot y moneda; la edición restaura el FX guardado y la persistencia USD siempre guarda el FX efectivo | Aplicado y reparado |
| Gestión de cotizaciones | Carpetas de clientes abiertas | Estado inicial cerrado; cada cliente se expande a demanda | Aplicado |
| Proyectos | Carpetas abiertas y filtro inicial por actividad | Carpetas cerradas; estado inicial “Activos”; el filtro de actividad queda apagado por defecto | Aplicado |
| Proyectos | Proyecto activo nuevo no visible | Operaciones recibe todos los proyectos del estado solicitado tanto en Proyectos como en Panel; usuarios comunes conservan el alcance por membresía/asignación | Aplicado |
| Proyectos | Costos/actividad tardaban en reflejar cargas nuevas | Fuente nativa activada desde `2026-08`, backfill único de períodos nativos y reconstrucción esperada antes de responder en altas, ediciones y bajas | Aplicado y reconstruido |
| Proyectos | Borrar la última carga podía dejar un costo mensual huérfano | El rebuild elimina hechos `source_app` sin fuente; ediciones reconstruyen mes anterior y nuevo, y el borrado en cascada de tareas reconstruye todos los meses afectados | Aplicado |
| Inicio de Tareas | Faltaba distribución de horas por proyecto | Gráfico mensual por proyecto, sumando horas de tareas y registros legacy | Aplicado |
| Inicio de Tareas | Faltaban tareas sin tiempo y carga directa | Lista de tareas abiertas sin carga propia y control rápido de 15/30/45/60 minutos, manual o temporizador | Aplicado |
| Inicio de Tareas | Fechas de trabajo poco visibles | Período inicio–entrega siempre visible y editable como rango civil | Aplicado |
| Inicio de Tareas | Faltaba contexto de proyecto | Proyecto visible en cada fila | Aplicado |
| Tareas / Proyecto | Control de reloj duplicado y sin resumen | Un único control rápido por tarea, con total y últimas cargas | Aplicado |
| Tareas / Proyecto | Horas cargadas por error no editables | Edición de horas, fecha y descripción; recálculo de costo y acumulados | Aplicado |
| Tareas / Proyecto | Gestión, Panel y Resumen estaban separados | Una sola vista “Gestión” reúne panel operativo, métricas, progreso, horas y brief | Aplicado |
| Horas | Una carga para otra persona se atribuía al usuario autenticado | Operaciones puede seleccionar a la persona real; el servidor valida el permiso y usuarios comunes solo pueden atribuirse a sí mismos | Aplicado |
| Horas | Edición/borrado de cargas ajenas | Solo Operaciones/Admin o la persona propietaria puede editar o eliminar; la entrada debe pertenecer a la tarea indicada | Aplicado |
| Horas | Las rutas legacy respondían antes de terminar el rebuild y permitían acceso por ID | Alta, consulta, edición y baja validan ownership; las mutaciones esperan la reconstrucción antes de responder | Aplicado |
| Capacidad | Duda sobre feriados y riesgo de doble descuento | Feriados hábiles únicos reducen la semana; fines de semana, feriados y ausencias superpuestas no se descuentan dos veces | Aplicado |
| Infraestructura | La migración de cierre fallaba con `current_role` | Identificadores reservados citados correctamente en la migración fuente y su copia runtime; arranque real validado | Aplicado |
| Infraestructura | Los jobs externos interferían con pruebas locales | `DISABLE_AUTO_SYNC=true` desactiva todos los jobs de sincronización y notificaciones, no solo el primero | Aplicado |

## Decisiones preservadas

### Clasificación de tareas

El PDF indica expresamente “No apliques nada, dejame pensar qué es mejor”. Por eso no se modificó la lógica de Pendiente / En curso / Atrasada / Finalizada. Sí se añadió la información solicitada alrededor de esa clasificación.

### Circuito de ausencias

La propuesta de solicitud, aprobación, saldo anual y alertas requiere definir primero:

- cupo anual y tratamiento por tipo de ausencia;
- si el saldo se mide en días hábiles y qué calendario aplica;
- quién aprueba y quién recibe alertas;
- reglas de rechazo, cancelación y modificación;
- visibilidad de motivos sensibles.

No se creó un workflow irreversible sin esas reglas. Sí se corrigió el impacto matemático de ausencias y feriados sobre capacidad.

## Cierre de datos reales

- 20 registros 2026 de personas con moneda contractual USD quedaron en `hourly_rate_usd`; no quedó ninguno de esos registros en `hourly_rate_ars`.
- El resolver canónico real convirtió USD 5,50/h a ARS 7.947,50/h con el FX global explícito 1.445 cuando agosto no tenía fila mensual, sin inventar un tipo de cambio ni asociar un `exchange_rate_id` inexistente.
- Los 25 valores corruptos `current_role = 'postgres'` fueron reparados: 17 roles vigentes, 8 roles históricos de freelancers y 18 subniveles derivados de nombres de rol existentes.
- `hours_data_source=1` y `app_mode_cutover_date=2026-08` se insertaron sólo porque no existían; la migración no pisa configuración explícita previa.
- El backfill creó el agregado pendiente del proyecto 65 para `2026-08`: 26,50 horas y ARS 887.101,28, con flags `source_app` y `source_task`.
- `applied_data_patches.0035_native_task_labor_backfill` evita repetir el backfill y sólo se registra después de un rebuild sin errores.
- La cotización USD 317 tenía seis miembros en ARS mientras la cabecera estaba en USD; la migración 0037 normalizó el equipo y dejó base/equipo en USD 3.018,84 (ratio 1,0000).
- Cinco hechos mensuales del contrato USD quedaron recalculados con USD 5,50/h y FX 1.445; el costo ARS total dejó de estar subestimado por tratar 5,50 como pesos.
- El sincronizador diario conserva tarifas contractuales USD en `hourly_rate_usd`, evitando que la siguiente ejecución revierta la normalización.

## Validación

- `npm run check`: aprobado.
- `npm test -- --run`: 158 tests aprobados; 11 integraciones opt-in omitidas por configuración.
- `npm run build`: aprobado.
- `git diff --check`: aprobado.
- Integración PostgreSQL real: migraciones `0035` y `0037` validadas con `ON_ERROR_STOP`; 0037 se probó primero dentro de una transacción con rollback, se aplicó y su segunda ejecución actualizó 0 filas.
- Integridad de configuración: se restauró el índice único esperado para `system_config.config_key`, necesario para los upserts administrativos existentes.
- Arranque real: migraciones `0031`, `0035` y `0037` aprobadas, backfill aprobado y servidor reiniciado con jobs externos desactivados.
- HTTP local: la aplicación respondió `200`; una API protegida respondió `401` sin sesión, como corresponde.
- Revisión visual final: pendiente de control manual. El navegador embebido no estuvo disponible después del último reinicio, por lo que no se declara una validación visual de la versión final.

## Cobertura añadida

`tests/feedback-mind-v2-7.test.ts` protege los cambios de Personal, Cotizaciones, carpetas cerradas, filtros de proyectos, home de tareas, control único de horas, edición, atribución autorizada, reconstrucción de costos, capacidad y unificación de Gestión. Incluye además una prueba ejecutable de normalización contractual USD y guards para snapshot, pruning y cascadas.
