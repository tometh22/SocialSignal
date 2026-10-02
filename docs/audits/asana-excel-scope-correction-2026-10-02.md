# Corrección del alcance operativo — 2026-10-02

El usuario aclaró que solo debía migrarse el contenido de `Proyectos y cotizaciones a pasar.xlsx` al módulo operativo. La posterior importación de 49 proyectos de Asana amplió ese alcance por error.

## Corrección autorizada

- Conservar los nueve proyectos del Excel (85–93), sus tareas supervivientes, secciones vacías, recurrencias, miembros, fechas y las modificaciones posteriores en Mind.
- Anular de forma recuperable los 41 proyectos activos creados desde Asana. Las cotizaciones del Excel de Insights se conservan sin importar su proyecto histórico al listado operativo.
- Trasladar las tareas originales de Asana de los proyectos del Excel a contenedores anulados; conservar la exportación original y sus horas en ese historial, sin eliminaciones físicas.
- Mantener las dos tareas en proyectos del Excel con cargas posteriores en Mind (727 y 1232), desligándolas del origen Asana. Resguardar copias originales para mantener el historial y sus relaciones.
- Conservar la carga posterior de Mind en Animal (tarea 1647) en su proyecto anulado. No trasladar ese costo a otro cliente o proyecto.
- Retirar únicamente membresías cuya fecha de creación corresponde exactamente a las transacciones de importación; preservar cualquier persona relacionada con trabajo vigente en Mind.
- Retirar las conexiones de historia financiera añadidas a los proyectos activos, manteniéndolas en sus archivos de recuperación.
- No modificar Personal, cotizaciones, equipos de cotizaciones, costos, horas nativas, cierres ni hechos financieros.

## Recuperación y controles

La operación usa el mismo bloqueo de migración, una transacción y un respaldo en `asana_scope_rollback_backups` con identificador `excel-only-scope-20261002`. El respaldo privado conserva los registros originales y el reporte. Las tareas/horas originales siguen almacenadas en proyectos anulados. No se debe restaurar el respaldo completo sobre actividad posterior: cualquier recuperación debe conciliar por identificador y conservar los cambios nuevos.

La versión 1.10.9 excluye proyectos anulados/cancelados de Mis tareas, calendario general y consultas globales. Operaciones puede inspeccionar explícitamente un proyecto archivado; los permisos habituales siguen aplicándose.

Verificaciones: cero tareas/horas de origen Asana en proyectos activos; nueve proyectos activos del Excel; conservación exacta de tareas nativas supervivientes y tablas financieras durante la corrección; 28 comprobaciones API locales de visibilidad/permisos e historial de horas reales, cuatro regresiones unitarias, typecheck y CI de checkout limpio.

Comprobación posterior: 155 verificaciones de producción aprobadas, nueve proyectos activos y 129 tareas vigentes tras conservar ediciones posteriores. Las 39 conexiones de nombres creadas por la importación histórica se desactivaron de forma recuperable para evitar reasignaciones futuras. 1.10.10 también filtra los recordatorios de tareas sin horas; los totales de horas reales conservan el historial nativo.
