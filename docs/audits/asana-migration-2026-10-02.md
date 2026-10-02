# Migración de Asana — 2026-10-02

## Alcance verificado

El inventario de la cuenta autorizada contiene 51 proyectos no archivados: dos plantillas ya publicadas en 1.10.4 y 49 proyectos/boards de trabajo. Se verificaron por separado `archived=false` y `completed=false` de los 49. No se acredita contenido inaccesible para esa cuenta.

La primera etapa 1.10.5 recuperó 44 CSV y 2.255 filas de tareas. Chrome bloqueó cinco CSV grandes y los archivos de horas del servidor de descargas. La exportación JSON oficial visible en Asana resolvió esa dependencia en la segunda etapa: se recorrieron todas las páginas de Warner Weekly y todas las páginas de los registros de tiempo, sin eludir la protección de Chrome ni extraer credenciales del navegador.

La extracción completa contiene:

- 12.071 identificadores únicos de tarea, representados en 12.081 relaciones con proyectos: diez tareas están compartidas.
- 11.818 entradas de tiempo únicas, con fecha civil, minutos, autor y proyecto atribuido por Asana.
- 378 secciones, incluidas vacías, propietarios y miembros originales de los 49 proyectos.
- 25 identidades originales; 23 vinculadas a Personal por correo único o alias explícito.

El Excel suministrado aporta nueve estructuras, seis cotizaciones, responsables, horas presupuestadas para dos contratos y un costo consumido de Insights. Su contenido no sustituye las tareas/horas reales de Asana.

## Implementación 1.10.6

- CLI con vista previa por defecto, validación previa de fuentes, transacción única y bloqueo consultivo. La aplicación exige `--apply`.
- GID único por tarea dentro de su proyecto; GID global único por entrada de tiempo, respetando su proyecto atribuido para evitar contabilizar una tarea compartida dos veces.
- Subtareas recursivas con identificadores exactos de padres, notas, fechas civiles, finalización, hitos y responsables. Se rechazan ciclos y exportaciones/paginaciones incompletas.
- Las tareas existentes conservan sus ediciones de Mind; sólo se concilia una jerarquía que siga coincidiendo con la exportación previa. Repetir la carga no duplica registros ni reemplaza ediciones posteriores.
- Miembros conocidos y propietario original como PM cuando Mind no tenga un propietario elegido. Identidades desconocidas conservadas sin inventar roles, contratos o tarifas.
- Horas originales en `asana_time_entries`, relacionadas con proyecto, tarea y Personal cuando existen. No se insertan nuevamente como gastos, hechos financieros ni liquidaciones. Las diferencias de un registro de tiempo ya importado requieren conciliación explícita.
- Entradas de tiempo de tareas eliminadas o movidas fuera del proyecto conservadas con sus identificadores/nombres originales; no se inventan tareas activas para esas horas. Hay 99 entradas de este tipo en el inventario extraído.
- Consulta paginada por proyecto, tarea/subtareas y mes. Historial de fuente separado de la carga nativa; costos históricos pendientes de conciliación claramente indicados.
- Filtro por origen para distinguir estructuras Excel/Mind de trabajo real importado, conservando el contexto de los padres.
- Ambos contratos Insights vinculados mediante relaciones FK; las seis cotizaciones del Excel permanecen asociadas. Historial mensual existente enlazado sin mover ni duplicar los registros financieros.

## Conservación de cambios concurrentes

En el segundo cotejo, 121 identificadores de la primera carga ya no estaban en Mind: 49 en Automatizaciones y 72 en Animal Proyectos Cortos. Se conserva ese retiro de la superficie activa y se guarda la instantánea original de Asana en proyectos inactivos recuperables. No se atribuye quién retiró los registros sin una evidencia de auditoría. El manifiesto conserva los identificadores importados para respetar retiros posteriores y evitar recreaciones silenciosas.

## Pendientes de datos/conciliación

1. Vincular las identidades históricas «Sil» y Alicia Crosa a Personal o mantenerlas como autores históricos externos.
2. Confirmar clientes y contratos de EM Turismo de Lujo, KBN Automatización, Netflix y Natura. Permanecen identificados bajo «Asana · cliente pendiente de confirmar»; no se inventan cotizaciones para los proyectos sin contrato en las fuentes.
3. Conciliar USD 10.981,58 informados como costo consumido de Insights y el reparto Weekly/Monthly del historial compartido. Los registros originales permanecen separados de su nueva contabilización.
4. Tarifa de Carolina Moreno, freelance sin horas fijas y excluida de costos hasta que el usuario la suministre.
5. Once padres externos al proyecto se conservan por GID, sin crear jerarquías cruzadas artificiales.
6. El histórico financiero contiene referencias antiguas sin proyecto recuperable (por ejemplo, proyecto 50/Colapinto). No se adjudican a proyectos actuales por similitud.

Esta migración es una instantánea autorizada, no una sincronización continua: no se crea un token nuevo ni se amplían permisos para sincronizar.

## Verificación

- 675 pruebas unitarias/regresión aprobadas; 11 pruebas opcionales existentes omitidas.
- PostgreSQL local independiente: 32 comprobaciones de primera etapa y 42 de segunda etapa. Permisos, filtros, paginación, fechas, hitos, padres exactos, idempotencia, retiros recuperables, conservación de ediciones y ausencia de duplicación financiera.
- Liberación con CI en checkout limpio antes del merge; después, salud/commit, cantidades/GID, identidades, contratos y conservación de los registros previos en producción.

## Resultado de producción

1.10.6 publicada por PR #283: 49 proyectos, 12.081 relaciones de tarea, 11.818 entradas de tiempo y 1.370.233 minutos cotejados por identificador. Se conservan 11.960 tareas de origen en proyectos activos y 121 en historial recuperable. Las seis cotizaciones del Excel siguen vinculadas. 27.247 comprobaciones de datos aprobadas; una edición concurrente de horas nativas y la normalización de una sección fueron identificadas y cotejadas con sus registros, sin revertirlas.

1.10.7 reduce la carga de la API de listados: evita repetir documentos originales completos dentro de cada tarea; la fuente íntegra permanece disponible en el detalle individual y en la base.

## Referencias técnicas de Asana

- [Tareas de un proyecto](https://developers.asana.com/reference/gettasksforproject)
- [Secciones de un proyecto](https://developers.asana.com/reference/getsectionsforproject)
- [Entradas de tiempo y proyecto atribuido](https://developers.asana.com/reference/gettimetrackingentries)
