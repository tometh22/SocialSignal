# Migración de Asana — 2026-10-02

## Alcance y evidencia

El inventario visible en la sesión de Asana contiene 51 proyectos: dos plantillas originales ya publicadas en 1.10.4 y 49 proyectos/boards de trabajo. Este inventario no acredita proyectos inaccesibles para esa cuenta.

Se recuperaron 44 exportaciones oficiales de tareas, con 2.255 identificadores de tarea únicos dentro de su proyecto. Cinco exportaciones grandes y las exportaciones de entradas de tiempo siguen bloqueadas por Chrome (`ERR_BLOCKED_BY_CLIENT`) en el servidor de archivos de Asana. No se elude esa protección.

El Excel suministrado contiene nueve estructuras operativas, seis cotizaciones, responsables, horas presupuestadas para dos contratos y un costo consumido informado para Insights. No contiene todas las tareas reales ni las entradas de tiempo con fecha y autor de Asana.

## Implementación

- Importador CLI con vista previa por defecto, validación completa previa, transacción única y bloqueo consultivo. La aplicación exige `--apply` explícito.
- Identificadores de origen únicos por proyecto y por tarea dentro de su proyecto; preservación de cada fila original y de duplicados del CSV en metadatos.
- Responsables resueltos a personas existentes mediante coincidencias únicas o aliases explícitos; nunca se crean personas por similitud.
- Secciones, descripciones, fechas civiles y finalización del CSV. Los CSV sólo distinguen completadas/no completadas: no se infiere avance intermedio.
- Jerarquías por orden de exportación y nombres únicos. Doce referencias externas/ambiguas quedan identificadas sin inventar relaciones.
- Reutilización de una tarea nativa sólo con título, responsable y sección coincidentes y únicos. Se preservan notas, jerarquía y trabajo nativo; los scaffolds sin fechas/horas pueden adoptar fechas y finalización del origen.
- Repetir el mismo archivo no duplica tareas ni sobrescribe modificaciones posteriores. Un archivo distinto requiere conciliación explícita.
- Relaciones FK entre proyecto y contratos adicionales, incluidos ambos contratos Insights, y vínculos al historial mensual existente. No se trasladan ni duplican costos/horas del historial.
- Cuatro clientes comerciales sin correspondencia confirmada quedan bajo un contenedor explícito «Asana · cliente pendiente de confirmar», sin cotización ni alias financiero automático.
- Totales de tiempo del CSV mostrados como instantánea de origen; no se convierten en horas facturables sin fecha y autor.
- Costo informado de Insights: USD 10.981,58, identificado como saldo pendiente de conciliación, no como gasto nuevo con fecha inventada.
- Detalle visible de migración por proyecto; los datos financieros requieren acceso de Operaciones.

## Pendientes reales

1. CSV de tareas de Epical Operaciones, Epical General, Kimberly Clark, Warner Weekly y Epical Prospección.
2. CSV de entradas de tiempo de los proyectos, con sus autores y fechas. No hay sincronización continua autorizada/configurada con un token Asana.
3. Cotejo de doce referencias de subtareas (mayormente boards de personas históricas y padres externos al archivo).
4. Confirmar clientes/cotizaciones de EM Turismo de Lujo, KBN Automatización, Netflix y Natura. No se inventan contratos para los demás proyectos sin cotización en las fuentes.
5. Conciliar el saldo consumido de Insights con el detalle de horas/costos y el reparto Weekly/Monthly del historial compartido; los registros originales se conservan.
6. Tarifa de Carolina Moreno, freelance sin horas fijas y excluida de costos hasta que el usuario la suministre.

## Verificación

- Suite existente más ocho casos de regresión del parser/proveniencia.
- PostgreSQL local: 32 comprobaciones CLI/API de vista previa, importación, idempotencia, preservación nativa/financiera, fechas, jerarquía, contratos, clientes pendientes y permisos.
- La liberación exige CI en checkout limpio antes del merge, seguido de verificación de salud y conciliación de cantidades/identificadores en producción.
